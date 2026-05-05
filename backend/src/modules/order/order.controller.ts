import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import * as orderService from './order.service';

function parseParamInt(param: string | string[] | undefined): number {
  const s = Array.isArray(param) ? param[0] : param;
  return parseInt(String(s ?? ''), 10);
}

export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const { shippingAddress, items } = req.body;
    const data = await orderService.createOrder({ userId: auth.userId, items, shippingAddress });
    res.status(201).json(success(data, 'Created'));
  } catch (err) { next(err); }
}

export async function listMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const result = await orderService.listUserOrders(auth.userId, req.query as Record<string, string | undefined>);
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) { next(err); }
}

export async function getMyOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) { res.status(404).json({ success: false, message: 'Order not found', errors: null }); return; }
    const data = await orderService.getUserOrder(auth.userId, id);
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function cancelMyOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) { res.status(401).json({ success: false, message: 'Unauthorized', errors: null }); return; }
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) { res.status(404).json({ success: false, message: 'Order not found', errors: null }); return; }
    const data = await orderService.cancelUserOrder(auth.userId, id);
    res.json(success(data, 'Cancelled'));
  } catch (err) { next(err); }
}

export async function listAdminOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await orderService.listAdminOrders(req.query as Record<string, string | undefined>);
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) { next(err); }
}

export async function getAdminOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) { res.status(404).json({ success: false, message: 'Order not found', errors: null }); return; }
    const data = await orderService.getAdminOrder(id);
    res.json(success(data));
  } catch (err) { next(err); }
}

export async function patchAdminStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) { res.status(404).json({ success: false, message: 'Order not found', errors: null }); return; }
    const { status } = req.body;
    const data = await orderService.updateOrderStatus(id, status);
    res.json(success(data, 'Updated'));
  } catch (err) { next(err); }
}
