import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import { enhanceProductDescription } from './product/product-description-enhancer';

export async function postEnhanceProductDescription(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, description } = req.body as { name?: string; description?: string | null };
    if (!name?.trim()) throw httpError(400, 'Product name is required');
    const current =
      description === undefined || description === null
        ? null
        : String(description).trim() === ''
          ? null
          : String(description).trim();
    const text = await enhanceProductDescription(name.trim(), current);
    res.json(success({ description: text }, 'Description generated'));
  } catch (err) {
    next(err);
  }
}
