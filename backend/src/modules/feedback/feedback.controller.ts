import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import * as feedbackService from './feedback.service';

function parseParamInt(param: string | string[] | undefined): number {
  const s = Array.isArray(param) ? param[0] : param;
  return parseInt(String(s ?? ''), 10);
}

export async function listAdminFeedbacks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await feedbackService.listAdminFeedbacks(q);
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) {
    next(err);
  }
}

export async function listByProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseParamInt(req.params.id);
    if (Number.isNaN(productId) || productId < 1) throw httpError(400, 'Invalid productId');
    const q = req.query as Record<string, string | undefined>;
    const result = await feedbackService.listFeedbacksByProduct(productId, q);
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) {
    next(err);
  }
}

export async function createFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, orderId, productId, typeId, rating, comment } = req.body as {
      userId?: number;
      orderId?: number;
      productId?: number;
      typeId?: number;
      rating?: number;
      comment?: string;
    };

    if (!userId || !orderId || !productId || rating === undefined) {
      throw httpError(400, 'userId, orderId, productId and rating are required');
    }

    const data = await feedbackService.createFeedback({
      userId: Number(userId),
      orderId: Number(orderId),
      productId: Number(productId),
      typeId: typeId ? Number(typeId) : undefined,
      rating: Number(rating),
      comment,
    });

    res.status(201).json(success(data, 'Feedback submitted successfully'));
  } catch (err) {
    next(err);
  }
}
