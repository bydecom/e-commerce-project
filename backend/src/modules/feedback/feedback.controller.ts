import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import * as feedbackService from './feedback.service';
import type { ActionPlanStatus } from '@prisma/client';

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
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const { orderId, productId, typeId, rating, comment } = req.body as {
      orderId?: number;
      productId?: number;
      typeId?: number;
      rating?: number;
      comment?: string;
    };

    if (!orderId || !productId || rating === undefined) {
      throw httpError(400, 'orderId, productId and rating are required');
    }

    const data = await feedbackService.createFeedback({
      userId: auth.userId,
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

// ── Action Plan handlers (Admin) ────────────────────────────────────────────

export async function createActionPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }

    const feedbackId = parseParamInt(req.params.id);
    if (Number.isNaN(feedbackId) || feedbackId < 1) throw httpError(400, 'Invalid feedbackId');

    const { title, description } = req.body as { title?: string; description?: string };
    if (!title?.trim()) throw httpError(400, 'title is required');

    const data = await feedbackService.createFeedbackActionPlan(feedbackId, auth.userId, {
      title: title.trim(),
      description: description?.trim(),
    });

    res.status(201).json(success(data, 'Action plan created'));
  } catch (err) {
    next(err);
  }
}

export async function updateActionPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const planId = parseParamInt(req.params.planId);
    if (Number.isNaN(planId) || planId < 1) throw httpError(400, 'Invalid planId');

    const { status, resolution, assigneeId } = req.body as {
      status?: ActionPlanStatus;
      resolution?: string;
      assigneeId?: number;
    };

    const validStatuses: ActionPlanStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'REJECTED'];
    if (status !== undefined && !validStatuses.includes(status)) {
      throw httpError(400, `status must be one of: ${validStatuses.join(', ')}`);
    }

    const data = await feedbackService.updateFeedbackActionPlan(planId, {
      status,
      resolution,
      assigneeId: assigneeId !== undefined ? Number(assigneeId) : undefined,
    });

    res.json(success(data, 'Action plan updated'));
  } catch (err) {
    next(err);
  }
}

export async function deleteActionPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const planId = parseParamInt(req.params.planId);
    if (Number.isNaN(planId) || planId < 1) throw httpError(400, 'Invalid planId');

    await feedbackService.deleteFeedbackActionPlan(planId);
    res.json(success(null, 'Action plan deleted'));
  } catch (err) {
    next(err);
  }
}
