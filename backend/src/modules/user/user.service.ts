import type { Role } from '@prisma/client';
import { prisma } from '../../db';
import { httpError } from '../../utils/http-error';

const userListSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  createdAt: true,
} as const;

export async function listUsers(params: { page: number; limit: number; search?: string }) {
  const page = Math.max(1, params.page);
  const limit = Math.min(100, Math.max(1, params.limit));
  const skip = (page - 1) * limit;
  const q = params.search?.trim();
  const where =
    q && q.length > 0
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: userListSelect,
    }),
  ]);

  return {
    data: rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function updateUserRole(targetId: number, newRole: Role) {
  if (newRole !== 'USER' && newRole !== 'ADMIN') {
    throw httpError(400, 'Invalid role');
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) {
    throw httpError(404, 'User not found');
  }

  if (target.role === 'ADMIN' && newRole === 'USER') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      throw httpError(409, 'Cannot remove the last administrator');
    }
  }

  return prisma.user.update({
    where: { id: targetId },
    data: { role: newRole },
    select: userListSelect,
  });
}
