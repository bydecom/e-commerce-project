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

export async function updateCategory(id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw httpError(400, 'name is required');

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Category not found');

  const duplicate = await prisma.category.findFirst({
    where: {
      name: { equals: trimmed, mode: 'insensitive' },
      NOT: { id },
    },
  });
  if (duplicate) throw httpError(409, 'Category name already exists');

  return prisma.category.update({
    where: { id },
    data: { name: trimmed },
    select: categorySelect,
  });
}

export async function deleteCategory(id: number) {
  const cat = await prisma.category.findUnique({
    where: { id },
    select: { id: true, _count: { select: { products: true } } },
  });
  if (!cat) throw httpError(404, 'Category not found');
  if (cat._count.products > 0) {
    throw httpError(409, 'Cannot delete category that has products');
  }
  await prisma.category.delete({ where: { id } });
}
