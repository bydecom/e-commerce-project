import type { Prisma, SentimentLabel } from '@prisma/client';
import { prisma } from '../../db';
import { parsePagination } from '../../utils/pagination';

const adminListInclude = {
  user: { select: { id: true, email: true, name: true } },
  product: { select: { id: true, name: true } },
} as const;

function parseSentiment(v: string | undefined): SentimentLabel | undefined {
  if (!v) return undefined;
  if (v === 'POSITIVE' || v === 'NEUTRAL' || v === 'NEGATIVE') return v;
  return undefined;
}

function parseRating(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 5) return undefined;
  return n;
}

export type AdminFeedbackListItem = {
  id: number;
  userId: number;
  productId: number;
  orderId: number;
  rating: number;
  comment: string | null;
  sentiment: SentimentLabel | null;
  user: { id: number; email: string; name: string | null };
  product: { id: number; name: string };
};

export async function listAdminFeedbacks(query: {
  page?: string;
  limit?: string;
  search?: string;
  sentiment?: string;
  rating?: string;
}) {
  const { page, limit, offset } = parsePagination({
    page: query.page,
    limit: query.limit ?? '20',
  });

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const sentiment = parseSentiment(query.sentiment);
  const rating = parseRating(query.rating);

  const where: Prisma.FeedbackWhereInput = {
    ...(sentiment ? { sentiment } : {}),
    ...(rating ? { rating } : {}),
    ...(search
      ? {
          OR: [
            { user: { is: { email: { contains: search, mode: 'insensitive' } } } },
            { user: { is: { name: { contains: search, mode: 'insensitive' } } } },
            { product: { is: { name: { contains: search, mode: 'insensitive' } } } },
            { comment: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, rows] = await prisma.$transaction([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { id: 'desc' },
      include: adminListInclude,
    }),
  ]);

  return {
    data: rows as unknown as AdminFeedbackListItem[],
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listFeedbacksByProduct(productId: number, query: { page?: string; limit?: string }) {
  const { page, limit, offset } = parsePagination({
    page: query.page,
    limit: query.limit ?? '20',
  });

  const where: Prisma.FeedbackWhereInput = { productId };

  const [total, rows] = await prisma.$transaction([
    prisma.feedback.count({ where }),
    prisma.feedback.findMany({
      where,
      skip: offset,
      take: limit,
      orderBy: { id: 'desc' },
      include: { user: { select: { id: true, name: true } } },
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
