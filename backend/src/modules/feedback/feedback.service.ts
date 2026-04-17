import type { Prisma, SentimentLabel } from '@prisma/client';
import { prisma } from '../../db';
import { parsePagination } from '../../utils/pagination';
import { httpError } from '../../utils/http-error';
import { analyzeFeedback } from '../ai/feedback/feedback-analyzer';

const adminListInclude = {
  user: { select: { id: true, email: true, name: true } },
  product: { select: { id: true, name: true } },
  type: { select: { id: true, name: true } },
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

function parseTypeId(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return n;
}

export type AdminFeedbackListItem = {
  id: number;
  userId: number;
  productId: number;
  orderId: number;
  typeId: number;
  rating: number;
  comment: string | null;
  sentiment: SentimentLabel | null;
  user: { id: number; email: string; name: string | null };
  product: { id: number; name: string };
  type: { id: number; name: string };
};

export async function listAdminFeedbacks(query: {
  page?: string;
  limit?: string;
  search?: string;
  sentiment?: string;
  rating?: string;
  typeId?: string;
}) {
  const { page, limit, offset } = parsePagination({
    page: query.page,
    limit: query.limit ?? '20',
  });

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const sentiment = parseSentiment(query.sentiment);
  const rating = parseRating(query.rating);
  const typeId = parseTypeId(query.typeId);

  const where: Prisma.FeedbackWhereInput = {
    ...(sentiment ? { sentiment } : {}),
    ...(rating ? { rating } : {}),
    ...(typeId ? { typeId } : {}),
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

// ── Create Feedback (User) ──────────────────────────────────────────────────

export async function createFeedback(data: {
  userId: number;
  orderId: number;
  productId: number;
  typeId?: number;
  rating: number;
  comment?: string;
}) {
  const { userId, orderId, productId, typeId, rating, comment } = data;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw httpError(400, 'Rating must be an integer between 1 and 5');
  }

  // Verify order exists and belongs to this user
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw httpError(404, 'Order not found');
  if (order.userId !== userId) throw httpError(403, 'Forbidden: this order does not belong to you');
  if (order.status !== 'DONE') throw httpError(400, 'Feedback can only be submitted for completed orders');

  // Verify the product is part of the order
  const orderItem = await prisma.orderItem.findFirst({ where: { orderId, productId } });
  if (!orderItem) throw httpError(400, 'This product was not found in the specified order');

  // Check for duplicate (unique constraint: orderId + productId)
  const duplicate = await prisma.feedback.findUnique({
    where: { orderId_productId: { orderId, productId } },
  });
  if (duplicate) throw httpError(409, 'Feedback has already been submitted for this product in this order');

  // Validate typeId only when user explicitly passes it
  if (typeId !== undefined) {
    const feedbackType = await prisma.feedbackType.findUnique({ where: { id: typeId } });
    if (!feedbackType || !feedbackType.isActive) {
      throw httpError(400, 'Invalid or inactive feedback type');
    }
  }

  // AI analyzes comment → resolvedTypeId + sentiment
  const analysis = comment?.trim()
    ? await analyzeFeedback(comment.trim())
    : { resolvedTypeId: null, sentiment: 'NEUTRAL' as const };

  // Priority 1: Use AI's resolved typeId
  // Priority 2: User explicitly passes it
  // Priority 3 (fallback): Use first active type in DB
  let finalTypeId = analysis.resolvedTypeId ?? typeId;

  if (!finalTypeId) {
    const unknownType = await prisma.feedbackType.findFirst({
      where: { name: 'Unknown', isActive: true },
    });
    if (!unknownType) throw httpError(500, 'No active FeedbackType found — please seed the database');
    finalTypeId = unknownType.id;
  }

  const created = await prisma.feedback.create({
    data: {
      userId,
      orderId,
      productId,
      typeId: finalTypeId,
      rating,
      comment: comment?.trim() ?? null,
      sentiment: analysis.sentiment,
    },
    include: {
      type: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return created;
}
