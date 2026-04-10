import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import * as categoryService from './category.service';

export async function listCategories(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await categoryService.listCategories();
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const b = req.body as Record<string, unknown>;
    const name = typeof b.name === 'string' ? b.name : '';
    const data = await categoryService.createCategory(name);
    res.status(201).json(success(data, 'Created'));
  } catch (err) {
    next(err);
  }
}
