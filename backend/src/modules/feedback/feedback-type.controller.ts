import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import type { DemoFeedbackTypeInput } from './feedback-type.service';
import * as feedbackTypeService from './feedback-type.service';

export async function listFeedbackTypes(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const data = await feedbackTypeService.listFeedbackTypes();
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function createFeedbackType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name?.trim()) throw httpError(400, 'Name is required');
    const data = await feedbackTypeService.createFeedbackType({ name, description });
    res.status(201).json(success(data, 'Feedback type created'));
  } catch (err) {
    next(err);
  }
}

/** POST body: { comment: string, types: DemoFeedbackTypeInput[] } — does not persist; uses snapshot for AI demo. */
export async function demoAnalyzeFeedback(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { comment, types } = req.body as {
      comment?: string;
      types?: DemoFeedbackTypeInput[];
    };
    const data = await feedbackTypeService.demoAnalyzeFeedback(comment ?? '', types ?? []);
    res.json(success(data, 'Demo analysis (not saved)'));
  } catch (err) {
    next(err);
  }
}

export async function updateFeedbackType(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id) || id < 1) throw httpError(400, 'Invalid id');

    const { name, description, isActive } = req.body as {
      name?: string;
      description?: string | null;
      isActive?: boolean;
    };
    const data = await feedbackTypeService.updateFeedbackType(id, { name, description, isActive });
    res.json(success(data, 'Feedback type updated'));
  } catch (err) {
    next(err);
  }
}
