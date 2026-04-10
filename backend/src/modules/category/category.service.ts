import { prisma } from '../../db';
import { httpError } from '../../utils/http-error';

const categorySelect = {
  id: true,
  name: true,
  _count: { select: { products: true } },
} as const;

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: categorySelect,
  });
}

export async function createCategory(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw httpError(400, 'name is required');

  const existing = await prisma.category.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) throw httpError(409, 'Category name already exists');

  return prisma.category.create({
    data: { name: trimmed },
    select: categorySelect,
  });
}
