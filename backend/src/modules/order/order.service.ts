import type { OrderStatus, Prisma, PrismaClient } from '@prisma/client';

type DbTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
import { prisma } from '../../db';
import { parsePagination } from '../../utils/pagination';
import { httpError } from '../../utils/http-error';

const orderItemInclude = {
  product: { select: { id: true, name: true } },
} as const;

const orderListInclude = {
  items: { include: orderItemInclude },
  user: { select: { id: true, email: true, name: true } },
} as const;

function mapItem(row: {
  productId: number;
  quantity: number;
  unitPrice: number;
  product: { id: number; name: string };
}) {
  return {
    productId: row.productId,
    name: row.product.name,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
  };
}

function mapOrderFull(order: {
  id: number;
  userId: number;
  status: OrderStatus;
  total: number;
  shippingAddress: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    productId: number;
    quantity: number;
    unitPrice: number;
    product: { id: number; name: string };
  }>;
  user: { id: number; email: string; name: string | null };
}) {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    total: order.total,
    shippingAddress: order.shippingAddress,
    items: order.items.map(mapItem),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    user: {
      id: order.user.id,
      email: order.user.email,
      name: order.user.name,
    },
  };
}

function mergeItems(
  items: Array<{ productId: number; quantity: number }>
): Array<{ productId: number; quantity: number }> {
  const map = new Map<number, number>();
  for (const it of items) {
    const productId =
      typeof it.productId === 'number' ? it.productId : parseInt(String(it.productId), 10);
    if (Number.isNaN(productId) || productId < 1) throw httpError(400, 'Invalid productId');
    const q = Math.floor(Number(it.quantity));
    if (!Number.isFinite(q) || q < 1) throw httpError(400, 'Invalid quantity');
    map.set(productId, (map.get(productId) ?? 0) + q);
  }
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function createOrder(body: {
  userId: number;
  items: Array<{ productId: number; quantity: number }>;
  shippingAddress: string;
}) {
  const userId = Math.floor(Number(body.userId));
  if (!Number.isFinite(userId) || userId < 1) throw httpError(400, 'userId is required');
  const shippingAddress = typeof body.shippingAddress === 'string' ? body.shippingAddress.trim() : '';
  if (!shippingAddress) throw httpError(400, 'shippingAddress is required');
  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw httpError(400, 'items must be a non-empty array');
  }

  const merged = mergeItems(body.items);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw httpError(400, 'Invalid userId');

    const lines: Array<{ productId: number; quantity: number; unitPrice: number }> = [];
    let total = 0;

    for (const line of merged) {
      const product = await tx.product.findUnique({ where: { id: line.productId } });
      if (!product) throw httpError(400, `Product ${line.productId} not found`);
      if (product.status !== 'AVAILABLE') {
        throw httpError(422, `Product "${product.name}" is not available for sale`);
      }
      if (product.stock < line.quantity) {
        throw httpError(422, `Insufficient stock for "${product.name}"`);
      }
      const unitPrice = product.price;
      total += unitPrice * line.quantity;
      lines.push({ productId: line.productId, quantity: line.quantity, unitPrice });
    }

    const order = await tx.order.create({
      data: {
        userId,
        total,
        shippingAddress,
        status: 'PENDING',
        items: {
          create: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        },
      },
      include: orderListInclude,
    });

    for (const l of lines) {
      await tx.product.update({
        where: { id: l.productId },
        data: { stock: { decrement: l.quantity } },
      });
    }

    return mapOrderFull(order);
  });
}

export async function listUserOrders(
  userId: number,
  query: { page?: string; limit?: string; status?: string }
) {
  const { page, limit, offset } = parsePagination({
    page: query.page,
    limit: query.limit ?? '20',
  });
  const statusFilter =
    query.status && ['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED'].includes(query.status)
      ? (query.status as OrderStatus)
      : undefined;

  const where: Prisma.OrderWhereInput = {
    userId,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { id: 'desc' },
      include: {
        items: { include: orderItemInclude },
        user: { select: { id: true, email: true, name: true } },
      },
    }),
  ]);

  return {
    data: rows.map((o) => mapOrderFull(o)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getUserOrder(userId: number, orderId: number) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: orderListInclude,
  });
  if (!order) throw httpError(404, 'Order not found');
  return mapOrderFull(order);
}

async function restoreStockForOrder(tx: DbTx, orderId: number) {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const it of items) {
    await tx.product.update({
      where: { id: it.productId },
      data: { stock: { increment: it.quantity } },
    });
  }
}

export async function cancelUserOrder(userId: number, orderId: number) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw httpError(404, 'Order not found');
    if (order.status !== 'PENDING') {
      throw httpError(422, 'Only pending orders can be cancelled');
    }
    await restoreStockForOrder(tx, orderId);
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
      include: orderListInclude,
    });
    return mapOrderFull(updated);
  });
}

export async function listAdminOrders(query: {
  page?: string;
  limit?: string;
  status?: string;
  search?: string;
}) {
  const { page, limit, offset } = parsePagination({
    page: query.page,
    limit: query.limit ?? '20',
  });
  const statusFilter =
    query.status && ['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED'].includes(query.status)
      ? (query.status as OrderStatus)
      : undefined;

  const search = typeof query.search === 'string' ? query.search.trim() : '';

  const where: Prisma.OrderWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search
      ? {
          user: {
            is: {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { id: 'desc' },
      include: orderListInclude,
    }),
  ]);

  return {
    data: rows.map((o) => mapOrderFull(o)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getAdminOrder(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: orderListInclude,
  });
  if (!order) throw httpError(404, 'Order not found');
  return mapOrderFull(order);
}

const allowedNext: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING'],
  SHIPPING: ['DONE'],
  DONE: [],
  CANCELLED: [],
};

export async function updateOrderStatus(orderId: number, nextStatus: OrderStatus) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw httpError(404, 'Order not found');

    const allowed = allowedNext[order.status];
    if (!allowed.includes(nextStatus)) {
      throw httpError(422, `Cannot transition from ${order.status} to ${nextStatus}`);
    }

    if (order.status === 'PENDING' && nextStatus === 'CANCELLED') {
      await restoreStockForOrder(tx, orderId);
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
      include: orderListInclude,
    });
    return mapOrderFull(updated);
  });
}
