import { Prisma, type Product, type ProductStatus } from '@prisma/client';
import { prisma } from '../../db';
import { parsePagination } from '../../utils/pagination';
import { httpError } from '../../utils/http-error';

function toTitleUnaccent(input: string): string {
  const n = input.normalize('NFD').replace(/\p{M}/gu, '');
  return n.replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function mapProduct(p: Product & { category?: { id: number; name: string } }) {
  return {
    id: p.id,
    name: p.name,
    titleUnaccent: p.title_unaccent,
    description: p.description,
    price: p.price,
    stock: p.stock,
    imageUrl: p.imageUrl,
    status: p.status,
    categoryId: p.categoryId,
    category: p.category ? { id: p.category.id, name: p.category.name } : undefined,
  };
}

const sortMap: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  newest: { id: 'desc' },
  oldest: { id: 'asc' },
};

/** `categoryIds=1&categoryIds=2` or `categoryIds=1,2`; merges with legacy `categoryId`. */
function parseCategoryIds(query: {
  categoryId?: string;
  categoryIds?: string | string[];
}): number[] | undefined {
  const ids: number[] = [];
  const raw = query.categoryIds;
  if (raw !== undefined && raw !== '') {
    const parts = Array.isArray(raw) ? raw : String(raw).split(',');
    for (const p of parts) {
      const n = parseInt(String(p).trim(), 10);
      if (!Number.isNaN(n)) ids.push(n);
    }
  }
  if (query.categoryId !== undefined && query.categoryId !== '') {
    const n = parseInt(query.categoryId, 10);
    if (!Number.isNaN(n)) ids.push(n);
  }
  const uniq = [...new Set(ids)];
  return uniq.length ? uniq : undefined;
}

export async function listProducts(query: {
  page?: string;
  limit?: string;
  search?: string;
  categoryId?: string;
  categoryIds?: string | string[];
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  status?: string;
}) {
  const { page, limit, offset } = parsePagination({
    page: query.page,
    limit: query.limit ?? '12',
  });

  const search = query.search?.trim();
  const categoryIds = parseCategoryIds(query);
  const minPrice = query.minPrice !== undefined && query.minPrice !== '' ? Number(query.minPrice) : undefined;
  const maxPrice = query.maxPrice !== undefined && query.maxPrice !== '' ? Number(query.maxPrice) : undefined;
  const sortKey = query.sort && sortMap[query.sort] ? query.sort : 'newest';
  const statusFilter =
    query.status && ['AVAILABLE', 'UNAVAILABLE', 'DRAFT'].includes(query.status)
      ? (query.status as ProductStatus)
      : undefined;

  const priceFilter: Prisma.FloatFilter | undefined =
    (minPrice !== undefined && !Number.isNaN(minPrice)) ||
    (maxPrice !== undefined && !Number.isNaN(maxPrice))
      ? {
          ...(minPrice !== undefined && !Number.isNaN(minPrice) ? { gte: minPrice } : {}),
          ...(maxPrice !== undefined && !Number.isNaN(maxPrice) ? { lte: maxPrice } : {}),
        }
      : undefined;

  const where: Prisma.ProductWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { title_unaccent: { contains: toTitleUnaccent(search), mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    ...(priceFilter ? { price: priceFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: sortMap[sortKey],
      include: { category: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    data: rows.map((r) => mapProduct(r)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getProductById(id: number) {
  const p = await prisma.product.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!p) throw httpError(404, 'Product not found');
  return mapProduct(p);
}

export async function createProduct(body: {
  name: string;
  description?: string | null;
  price: number;
  stock: number;
  imageUrl?: string | null;
  categoryId: number;
  status?: ProductStatus;
}) {
  const cat = await prisma.category.findUnique({ where: { id: body.categoryId } });
  if (!cat) throw httpError(400, 'Invalid categoryId');

  const name = body.name?.trim();
  if (!name) throw httpError(400, 'name is required');
  if (body.price < 0 || Number.isNaN(body.price)) throw httpError(400, 'Invalid price');
  if (body.stock < 0 || Number.isNaN(body.stock)) throw httpError(400, 'Invalid stock');

  const p = await prisma.product.create({
    data: {
      name,
      title_unaccent: toTitleUnaccent(name),
      description: body.description ?? null,
      price: body.price,
      stock: Math.floor(body.stock),
      imageUrl: body.imageUrl ?? null,
      categoryId: body.categoryId,
      status: body.status ?? 'DRAFT',
    },
    include: { category: { select: { id: true, name: true } } },
  });
  return mapProduct(p);
}

export async function updateProduct(
  id: number,
  body: {
    name?: string;
    description?: string | null;
    price?: number;
    stock?: number;
    imageUrl?: string | null;
    categoryId?: number;
    status?: ProductStatus;
  }
) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw httpError(404, 'Product not found');

  if (body.categoryId !== undefined) {
    const cat = await prisma.category.findUnique({ where: { id: body.categoryId } });
    if (!cat) throw httpError(400, 'Invalid categoryId');
  }
  if (body.price !== undefined && (body.price < 0 || Number.isNaN(body.price))) {
    throw httpError(400, 'Invalid price');
  }
  if (body.stock !== undefined && (body.stock < 0 || Number.isNaN(body.stock))) {
    throw httpError(400, 'Invalid stock');
  }

  const name = body.name !== undefined ? body.name.trim() : existing.name;
  if (!name) throw httpError(400, 'name cannot be empty');

  const p = await prisma.product.update({
    where: { id },
    data: {
      ...(body.name !== undefined && {
        name,
        title_unaccent: toTitleUnaccent(name),
      }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.price !== undefined && { price: body.price }),
      ...(body.stock !== undefined && { stock: Math.floor(body.stock) }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.status !== undefined && { status: body.status }),
    },
    include: { category: { select: { id: true, name: true } } },
  });
  return mapProduct(p);
}

export async function deleteProduct(id: number) {
  try {
    await prisma.product.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') throw httpError(404, 'Product not found');
      if (e.code === 'P2003' || e.code === 'P2014') {
        throw httpError(409, 'Cannot delete product referenced by orders');
      }
    }
    throw e;
  }
}

export type LandingProduct = Pick<Product, 'id' | 'name' | 'price' | 'imageUrl'> & { soldQty: number };

export type LandingCategoryWithProducts = {
  id: number;
  name: string;
  products: Pick<Product, 'id' | 'name' | 'price' | 'imageUrl'>[];
};

export type LandingFeedback = {
  id: number;
  rating: number;
  comment: string;
  user: { name: string | null };
  product: { name: string };
};

export async function getLandingPageData(): Promise<{
  topSellers: LandingProduct[];
  categoriesWithProducts: LandingCategoryWithProducts[];
  recentFeedbacks: LandingFeedback[];
}> {
  const [topRaw, categoriesWithProducts, recentFeedbacks] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { status: 'DONE' },
        product: { status: 'AVAILABLE' },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    }),
    prisma.category.findMany({
      take: 3,
      select: {
        id: true,
        name: true,
        products: {
          where: { status: 'AVAILABLE' },
          take: 4,
          select: { id: true, name: true, price: true, imageUrl: true },
        },
      },
    }),
    prisma.feedback.findMany({
      where: { rating: { gte: 4 }, comment: { not: null } },
      take: 3,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        rating: true,
        comment: true,
        user: { select: { name: true } },
        product: { select: { name: true } },
      },
    }),
  ]);

  const productIds = topRaw.map((x) => x.productId);
  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds }, status: 'AVAILABLE' },
          select: { id: true, name: true, price: true, imageUrl: true },
        })
      : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  const topSellers: LandingProduct[] = topRaw
    .map((x) => {
      const p = byId.get(x.productId);
      if (!p) return null;
      return { ...p, soldQty: x._sum.quantity ?? 0 };
    })
    .filter((x): x is LandingProduct => x !== null);

  return {
    topSellers,
    categoriesWithProducts,
    recentFeedbacks: recentFeedbacks.map((f) => ({
      ...f,
      comment: f.comment ?? '',
    })),
  };
}
