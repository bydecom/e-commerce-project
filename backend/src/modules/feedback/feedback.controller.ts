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
    const result = await feedbackService.listAdminFeedbacks(req.query as Record<string, string | undefined>);
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) { next(err); }
}

export async function listByProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = parseParamInt(req.params.id);
    if (Number.isNaN(productId) || productId < 1) throw httpError(400, 'Invalid productId');
    const result = await feedbackService.listFeedbacksByProduct(productId, req.query as Record<string, string | undefined>);
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) { next(err); }
}

export async function createFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const { orderId, productId, typeId, rating, comment } = req.body;
    const data = await feedbackService.createFeedback({
      userId: auth.userId, orderId, productId, typeId, rating, comment,
    });
    res.status(201).json(success(data, 'Feedback submitted successfully'));
  } catch (err) { next(err); }
}

export async function createActionPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const feedbackId = parseParamInt(req.params.id);
    if (Number.isNaN(feedbackId) || feedbackId < 1) throw httpError(400, 'Invalid feedbackId');
    const { title, description } = req.body;
    const data = await feedbackService.createFeedbackActionPlan(feedbackId, auth.userId, { title, description });
    res.status(201).json(success(data, 'Action plan created'));
  } catch (err) { next(err); }
}

export async function updateActionPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const planId = parseParamInt(req.params.planId);
    if (Number.isNaN(planId) || planId < 1) throw httpError(400, 'Invalid planId');
    const data = await feedbackService.updateFeedbackActionPlan(planId, req.body);
    res.json(success(data, 'Action plan updated'));
  } catch (err) { next(err); }
}

export async function deleteActionPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const planId = parseParamInt(req.params.planId);
    if (Number.isNaN(planId) || planId < 1) throw httpError(400, 'Invalid planId');
    await feedbackService.deleteFeedbackActionPlan(planId);
    res.json(success(null, 'Action plan deleted'));
  } catch (err) { next(err); }
}
