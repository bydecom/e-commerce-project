import type { OrderStatus, PaymentStatus, Prisma, PrismaClient, Role } from '@prisma/client';

type DbTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
import { prisma } from '../../db';
import { parsePagination } from '../../utils/pagination';
import { httpError } from '../../utils/http-error';
import { sendMail } from '../../utils/mail';
import { StoreSettingService } from '../store-setting/store-setting.service';
import { buildOrderCompletedEmail } from './email-templates/order-completed-email';

const orderItemInclude = {
  product: { select: { id: true, name: true, imageUrl: true } },
} as const;

const orderListInclude = {
  items: { include: orderItemInclude },
  user: { select: { id: true, email: true, name: true } },
  paymentTransactions: { orderBy: { createdAt: 'desc' } },
} as const;

async function sendOrderCompletedEmail(order: {
  id: number;
  total: number;
  user: { email: string; name: string | null };
  items: Array<{ name: string; quantity: number }>;
}): Promise<void> {
  const setting = await StoreSettingService.getSetting();
  const shopName = setting?.name?.trim() || 'Shop';
  const orderUrl = `${process.env.CLIENT_URL?.trim() || 'https://localhost:4200'}/orders/${order.id}`;
  const customerName = order.user.name?.trim() || 'my friend';

  const totalVnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(order.total);

  const { subject, text, html } = buildOrderCompletedEmail({
    shopName,
    orderId: order.id,
    customerName,
    orderUrl,
    items: order.items,
    totalVnd,
    supportEmail: setting?.email,
    supportPhone: setting?.phone,
  });

  try {
    await sendMail({
      to: order.user.email,
      subject,
      text,
      html,
    });
    // eslint-disable-next-line no-console
    console.log(`[Mail] Order completed mail sent to ${order.user.email}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Mail Error] Could not send order completed email:', err);
  }
}

function mapItem(
  row: {
    productId: number;
    quantity: number;
    unitPrice: number;
    product: { id: number; name: string; imageUrl: string | null };
  },
  reviewedSet: Set<string>
) {
  const key = `${row.productId}`;
  return {
    productId: row.productId,
    name: row.product.name,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    imageUrl: row.product.imageUrl,
    isReviewed: reviewedSet.has(key),
  };
}

function mapOrderFull(
  order: {
    id: number;
    userId: number;
    status: OrderStatus;
    total: number;
    shippingAddress: string;
    createdAt: Date;
    updatedAt: Date;
    paymentStatus: PaymentStatus;
    items: Array<{
      productId: number;
      quantity: number;
      unitPrice: number;
      product: { id: number; name: string; imageUrl: string | null };
    }>;
    user: { id: number; email: string; name: string | null };
    paymentTransactions: Array<{
      id: number;
      vnp_TxnRef: string;
      vnp_TransactionNo: string | null;
      vnp_Amount: number | null;
      vnp_BankCode: string | null;
      vnp_PayDate: string | null;
      vnp_ResponseCode: string | null;
      vnp_TransactionStatus: string | null;
      isSuccess: boolean;
      rawQuery: Prisma.JsonValue;
      createdAt: Date;
    }>;
  },
  reviewedProductIds: Set<number>
) {
  const reviewedSet = new Set([...reviewedProductIds].map((id) => `${id}`));
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
    shippingAddress: order.shippingAddress,
    items: order.items.map((it) => mapItem(it, reviewedSet)),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    paymentTransactions: order.paymentTransactions.map((txn) => ({
      id: txn.id,
      vnp_TxnRef: txn.vnp_TxnRef,
      vnp_TransactionNo: txn.vnp_TransactionNo,
      vnp_Amount: txn.vnp_Amount,
      vnp_BankCode: txn.vnp_BankCode,
      vnp_PayDate: txn.vnp_PayDate,
      vnp_ResponseCode: txn.vnp_ResponseCode,
      vnp_TransactionStatus: txn.vnp_TransactionStatus,
      isSuccess: txn.isSuccess,
      rawQuery: txn.rawQuery,
      createdAt: txn.createdAt.toISOString(),
    })),
    user: {
      id: order.user.id,
      email: order.user.email,
      name: order.user.name,
    },
  };
}

async function getReviewedProductIdsForOrder(userId: number, orderId: number): Promise<Set<number>> {
  const rows = await prisma.feedback.findMany({
    where: { userId, orderId },
    select: { productId: true },
  });
  return new Set(rows.map((r) => r.productId));
}

async function getReviewedPairsForOrders(
  userId: number,
  orderIds: number[]
): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();
  const rows = await prisma.feedback.findMany({
    where: { userId, orderId: { in: orderIds } },
    select: { orderId: true, productId: true },
  });
  return new Set(rows.map((r) => `${r.orderId}:${r.productId}`));
}

function mergeItems(
  items: Array<{ productId: number; quantity: number }>
): Array<{ productId: number; quantity: number }> {
  const map = new Map<number, number>();
  for (const it of items) {
    const productId = it.productId;
    const q = it.quantity;
    map.set(productId, (map.get(productId) ?? 0) + q);
  }
  return [...map.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function createOrder(body: {
  userId: number;
  items: Array<{ productId: number; quantity: number }>;
  shippingAddress: string;
  role?: Role;
}) {
  const userId = Math.floor(Number(body.userId));
  const shippingAddress = body.shippingAddress;

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
      const unitPrice = product.price;
      total += unitPrice * line.quantity;
      lines.push({ productId: line.productId, quantity: line.quantity, unitPrice });
    }

    // Atomic-ish stock decrement: prevents oversell under concurrent order creation.
    // If any line cannot be decremented (stock < qty), we abort and rollback.
    for (const l of lines) {
      const updated = await tx.product.updateMany({
        where: { id: l.productId, stock: { gte: l.quantity }, status: 'AVAILABLE' },
        data: { stock: { decrement: l.quantity } },
      });
      if (updated.count !== 1) {
        throw httpError(422, `Insufficient stock for product ${l.productId}`, {
          productId: l.productId,
          requestedQuantity: l.quantity,
        });
      }
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
        events: {
          create: [{
            type: 'ORDER_STATUS_CHANGED',
            newValue: 'PENDING',
            note: 'Order placed successfully',
            changedById: userId,
            changedByRole: body.role ?? 'USER',
          }],
        },
      },
      include: orderListInclude,
    });

    // New orders are not reviewed yet.
    return mapOrderFull(order, new Set());
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
      include: orderListInclude,
    }),
  ]);

  const reviewedPairs = await getReviewedPairsForOrders(
    userId,
    rows.map((o) => o.id)
  );

  return {
    data: rows.map((o) => {
      const reviewedProductIds = new Set<number>();
      for (const it of o.items) {
        if (reviewedPairs.has(`${o.id}:${it.productId}`)) {
          reviewedProductIds.add(it.productId);
        }
      }
      return mapOrderFull(o, reviewedProductIds);
    }),
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
  const reviewedProductIds = await getReviewedProductIdsForOrder(userId, orderId);
  return mapOrderFull(order, reviewedProductIds);
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

export async function cancelUserOrder(userId: number, orderId: number, role: Role = 'USER') {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw httpError(404, 'Order not found');
    if (order.status !== 'PENDING') {
      throw httpError(422, 'Only pending orders can be cancelled');
    }
    await restoreStockForOrder(tx, orderId);
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        events: {
          create: {
            type: 'ORDER_STATUS_CHANGED',
            oldValue: order.status,
            newValue: 'CANCELLED',
            changedById: userId,
            changedByRole: role,
            note: 'Order cancelled by user',
          },
        },
      },
      include: orderListInclude,
    });
    const reviewedProductIds = await getReviewedProductIdsForOrder(userId, orderId);
    return mapOrderFull(updated, reviewedProductIds);
  });
}

/**
 * System cancellation used by payment/TTL flows.
 * - Only cancels when status is PENDING
 * - Restores stock and marks CANCELLED in the same transaction
 * - Idempotent-ish: if not pending, returns the current order
 */
export async function cancelOrderSystem(orderId: number) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw httpError(404, 'Order not found');
    if (order.status !== 'PENDING') {
      const existing = await tx.order.findUnique({ where: { id: orderId }, include: orderListInclude });
      if (!existing) throw httpError(404, 'Order not found');
      return mapOrderFull(existing, new Set());
    }
    await restoreStockForOrder(tx, orderId);
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        events: {
          create: {
            type: 'ORDER_STATUS_CHANGED',
            oldValue: order.status,
            newValue: 'CANCELLED',
            note: 'Order automatically cancelled by system (TTL expired)',
          },
        },
      },
      include: orderListInclude,
    });
    return mapOrderFull(updated, new Set());
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
    data: rows.map((o) => mapOrderFull(o, new Set())),
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
  // Admin view: no userId context => do not mark reviewed.
  return mapOrderFull(order, new Set());
}

const allowedNext: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING'],
  SHIPPING: ['DONE'],
  DONE: [],
  CANCELLED: [],
};

export async function updateOrderStatus(orderId: number, nextStatus: OrderStatus, adminId?: number, adminRole?: Role) {
  const updated = await prisma.$transaction(async (tx) => {
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
      data: {
        status: nextStatus,
        events: {
          create: {
            type: 'ORDER_STATUS_CHANGED',
            oldValue: order.status,
            newValue: nextStatus,
            changedById: adminId,
            changedByRole: adminRole ?? null,
            note: `Admin changed status from ${order.status} to ${nextStatus}`,
          },
        },
      },
      include: orderListInclude,
    });
    // Admin update: no userId context => do not mark reviewed.
    return mapOrderFull(updated, new Set());
  });

  if (nextStatus === 'DONE' && updated.user?.email) {
    void sendOrderCompletedEmail({
      id: updated.id,
      total: updated.total,
      user: { email: updated.user.email, name: updated.user.name },
      items: updated.items.map((it) => ({ name: it.name, quantity: it.quantity })),
    });
  }

  return updated;
}

export async function getOrderEvents(orderId: number) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw httpError(404, 'Order not found');
  const events = await prisma.orderEvent.findMany({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
    include: { changedBy: { select: { id: true, email: true, name: true } } },
  });
  return events.map((e) => ({
    id: e.id,
    orderId: e.orderId,
    type: e.type,
    oldValue: e.oldValue,
    newValue: e.newValue,
    note: e.note,
    changedById: e.changedById,
    changedByRole: e.changedByRole,
    changedBy: e.changedBy ? { id: e.changedBy.id, email: e.changedBy.email, name: e.changedBy.name } : null,
    createdAt: e.createdAt.toISOString(),
  }));
}
