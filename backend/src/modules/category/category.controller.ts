import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import * as categoryService from './category.service';
import type { createCategorySchema, updateCategorySchema } from './category.schema';
import type { z } from 'zod';

type CreateBody = z.infer<typeof createCategorySchema>;
type UpdateBody = z.infer<typeof updateCategorySchema>;

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
    const { name } = req.body as CreateBody;
    const data = await categoryService.createCategory(name);
    res.status(201).json(success(data, 'Created'));
  } catch (err) {
    next(err);
  }
}

function parseIdParam(req: Request): number {
  return parseInt(String(req.params['id']), 10);
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid id', errors: null });
      return;
    }
    const { name } = req.body as UpdateBody;
    const data = await categoryService.updateCategory(id, name!);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid id', errors: null });
      return;
    }
    await categoryService.deleteCategory(id);
    res.json(success(null, 'Deleted'));
  } catch (err) {
    next(err);
  }
}
