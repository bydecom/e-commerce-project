import type { Role } from '@prisma/client';
import { prisma } from '../../db';
import { httpError } from '../../utils/http-error';

const userMeSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  provinceId: true,
  districtId: true,
  wardId: true,
  streetAddress: true,
  fullAddress: true,
  role: true,
  createdAt: true,
} as const;

export async function listUsers(params: { page: number; limit: number; search?: string; role?: Role }) {
  const page = Math.max(1, params.page);
  const limit = Math.min(100, Math.max(1, params.limit));
  const skip = (page - 1) * limit;
  const q = params.search?.trim();
  const where = {
    ...(q && q.length > 0
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(params.role ? { role: params.role } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ role: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
        _count: { select: { orders: true } },
        orders: {
          where: { paymentStatus: 'PAID' },
          select: { total: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
  ]);

  return {
    data: rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      createdAt: u.createdAt,
      orderCount: u._count.orders,
      totalSpent: u.orders.reduce((sum, o) => sum + o.total, 0),
      lastOrderAt: u.orders[0]?.createdAt ?? null,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getMe(userId: number) {
  const id = Math.floor(Number(userId));
  if (!Number.isFinite(id) || id < 1) {
    throw httpError(401, 'Unauthorized');
  }
  const user = await prisma.user.findUnique({
    where: { id },
    select: userMeSelect,
  });
  if (!user) {
    throw httpError(404, 'User not found');
  }
  return user;
}

export async function updateMe(
  userId: number,
  patch: {
    name?: string | null;
    phone?: string | null;
    provinceId?: string | null;
    districtId?: string | null;
    wardId?: string | null;
    streetAddress?: string | null;
    fullAddress?: string | null;
  }
) {
  const id = Math.floor(Number(userId));
  if (!Number.isFinite(id) || id < 1) {
    throw httpError(401, 'Unauthorized');
  }

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    throw httpError(404, 'User not found');
  }

  return prisma.user.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      ...(patch.provinceId !== undefined ? { provinceId: patch.provinceId } : {}),
      ...(patch.districtId !== undefined ? { districtId: patch.districtId } : {}),
      ...(patch.wardId !== undefined ? { wardId: patch.wardId } : {}),
      ...(patch.streetAddress !== undefined ? { streetAddress: patch.streetAddress } : {}),
      ...(patch.fullAddress !== undefined ? { fullAddress: patch.fullAddress } : {}),
    },
    select: userMeSelect,
  });
}
