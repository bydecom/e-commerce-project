import type { NextFunction, Request, Response } from 'express';
import type { ProductStatus } from '@prisma/client';
import { success } from '../../utils/response';
import * as productService from './product.service';

/** Express may type `req.params` as `string | string[]` depending on typings. */
function parseParamInt(param: string | string[] | undefined): number {
  const s = Array.isArray(param) ? param[0] : param;
  return parseInt(String(s ?? ''), 10);
}

export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await productService.listProducts(
      req.query as Parameters<typeof productService.listProducts>[0]
    );
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) {
    next(err);
  }
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
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const b = req.body as Record<string, unknown>;
    const name = typeof b.name === 'string' ? b.name : '';
    const categoryId = typeof b.categoryId === 'number' ? b.categoryId : parseInt(String(b.categoryId), 10);
    if (Number.isNaN(categoryId)) {
      res.status(400).json({ success: false, message: 'categoryId is required', errors: null });
      return;
    }
    const price = Number(b.price);
    const stock = Number(b.stock);
    const description = b.description === undefined || b.description === null ? null : String(b.description);
    const imageUrl =
      b.imageUrl === undefined || b.imageUrl === null || b.imageUrl === ''
        ? null
        : String(b.imageUrl);
    const status =
      b.status && ['AVAILABLE', 'UNAVAILABLE', 'DRAFT'].includes(String(b.status))
        ? (String(b.status) as ProductStatus)
        : undefined;

    const data = await productService.createProduct({
      name,
      description,
      price,
      stock,
      imageUrl,
      categoryId,
      status,
    });
    res.status(201).json(success(data, 'Created'));
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) {
      res.status(404).json({ success: false, message: 'Product not found', errors: null });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const payload: Parameters<typeof productService.updateProduct>[1] = {};

    if (b.name !== undefined) payload.name = String(b.name);
    if (b.description !== undefined) {
      payload.description = b.description === null ? null : String(b.description);
    }
    if (b.price !== undefined) payload.price = Number(b.price);
    if (b.stock !== undefined) payload.stock = Number(b.stock);
    if (b.imageUrl !== undefined) {
      payload.imageUrl =
        b.imageUrl === null || b.imageUrl === '' ? null : String(b.imageUrl);
    }
    if (b.categoryId !== undefined) {
      const cid =
        typeof b.categoryId === 'number' ? b.categoryId : parseInt(String(b.categoryId), 10);
      if (Number.isNaN(cid)) {
        res.status(400).json({ success: false, message: 'Invalid categoryId', errors: null });
        return;
      }
      payload.categoryId = cid;
    }
    if (b.status !== undefined && ['AVAILABLE', 'UNAVAILABLE', 'DRAFT'].includes(String(b.status))) {
      payload.status = String(b.status) as ProductStatus;
    }

    const data = await productService.updateProduct(id, payload);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
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
  } catch (err) {
    next(err);
  }
}

export async function getLandingPage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await productService.getLandingPageData();
    res.json(success(data, 'Landing page data retrieved successfully'));
  } catch (err) {
    next(err);
  }
}
