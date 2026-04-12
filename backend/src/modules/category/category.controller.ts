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

function parseIdParam(req: Request): number {
  const raw = req.params['id'];
  const s = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(String(s), 10);
}

export async function updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseIdParam(req);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid id', errors: null });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const name = typeof b.name === 'string' ? b.name : '';
    const data = await categoryService.updateCategory(id, name);
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
