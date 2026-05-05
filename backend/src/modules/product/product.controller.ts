import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import * as productService from './product.service';

function parseParamInt(param: string | string[] | undefined): number {
  const s = Array.isArray(param) ? param[0] : param;
  return parseInt(String(s ?? ''), 10);
}

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productService.searchSmartHybridList(
      req.query as Parameters<typeof productService.searchSmartHybridList>[0]
    );
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) { next(err); }
}

export async function listProductsAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productService.listProducts(
      req.query as Parameters<typeof productService.listProducts>[0]
    );
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) { next(err); }
}

export async function getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) {
      res.status(404).json({ success: false, message: 'Product not found', errors: null });
      return;
    }
    const data = await productService.getProductById(id);
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = {
      ...req.body,
      imageUrl:    req.body.imageUrl || null,
      description: req.body.description ?? null,
    };
    const data = await productService.createProduct(payload);
    res.status(201).json(success(data, 'Created'));
  } catch (err) { next(err); }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) {
      res.status(404).json({ success: false, message: 'Product not found', errors: null });
      return;
    }
    const payload = {
      ...req.body,
      ...(req.body.imageUrl !== undefined ? { imageUrl: req.body.imageUrl || null } : {}),
    };
    const data = await productService.updateProduct(id, payload);
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) {
      res.status(404).json({ success: false, message: 'Product not found', errors: null });
      return;
    }
    await productService.deleteProduct(id);
    res.json(success(null, 'Deleted'));
  } catch (err) { next(err); }
}

export async function getLandingPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await productService.getLandingPageData();
    res.json(success(data, 'Landing page data retrieved successfully'));
  } catch (err) { next(err); }
}

export async function searchSmart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const keyword = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = typeof req.query.limit === 'string'
      ? Math.min(parseInt(req.query.limit, 10) || 5, 20) : 5;
    if (!keyword) { res.json(success([])); return; }
    const data = await productService.searchSmartHybrid(keyword, limit);
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function listSmart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productService.searchSmartHybridList(
      req.query as Parameters<typeof productService.searchSmartHybridList>[0]
    );
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) { next(err); }
}
