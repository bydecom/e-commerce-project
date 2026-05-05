import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import * as cartService from './cart.service';

function parseParamInt(param: string | string[] | undefined): number {
  const s = Array.isArray(param) ? param[0] : param;
  return parseInt(String(s ?? ''), 10);
}

export async function putCartItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const productId = parseParamInt(req.params.productId);
    if (Number.isNaN(productId)) throw httpError(400, 'Invalid productId');
    const { quantity, name, mode } = req.body;
    const item = await cartService.upsertItemWithStock({ userId: auth.userId, productId, quantity, name, mode });
    res.status(200).json(success(item, 'OK'));
  } catch (err) { next(err); }
}

export async function getMyCart(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const items = await cartService.getCart(auth.userId);
    res.json(success({ items }, 'OK'));
  } catch (err) { next(err); }
}

export async function deleteCartItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const productId = parseParamInt(req.params.productId);
    if (Number.isNaN(productId)) throw httpError(400, 'Invalid productId');
    const result = await cartService.removeItem({ userId: auth.userId, productId });
    res.json(success(result, 'OK'));
  } catch (err) { next(err); }
}

export async function getMyCartWithPricing(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const data = await cartService.getCartWithPricing(auth.userId);
    res.json(success(data, 'OK'));
  } catch (err) { next(err); }
}
