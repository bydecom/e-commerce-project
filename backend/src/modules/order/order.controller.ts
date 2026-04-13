import type { NextFunction, Request, Response } from 'express';
import type { OrderStatus } from '@prisma/client';
import { success } from '../../utils/response';
import * as orderService from './order.service';

function parseParamInt(param: string | string[] | undefined): number {
  const s = Array.isArray(param) ? param[0] : param;
  return parseInt(String(s ?? ''), 10);
}

export async function createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const shippingAddress = typeof b.shippingAddress === 'string' ? b.shippingAddress : '';
    const items = Array.isArray(b.items) ? (b.items as Array<{ productId: number; quantity: number }>) : [];

    const data = await orderService.createOrder({ userId: auth.userId, items, shippingAddress });
    res.status(201).json(success(data, 'Created'));
  } catch (err) {
    next(err);
  }
}

export async function listMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const q = req.query as Record<string, string | undefined>;
    const result = await orderService.listUserOrders(auth.userId, q);
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) {
    next(err);
  }
}

export async function getMyOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) {
      res.status(404).json({ success: false, message: 'Order not found', errors: null });
      return;
    }
    const data = await orderService.getUserOrder(auth.userId, id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function cancelMyOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) {
      res.status(404).json({ success: false, message: 'Order not found', errors: null });
      return;
    }
    const data = await orderService.cancelUserOrder(auth.userId, id);
    res.json(success(data, 'Cancelled'));
  } catch (err) {
    next(err);
  }
}

export async function listAdminOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await orderService.listAdminOrders(q);
    res.json(success(result.data, 'OK', result.meta));
  } catch (err) {
    next(err);
  }
}

export async function getAdminOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) {
      res.status(404).json({ success: false, message: 'Order not found', errors: null });
      return;
    }
    const data = await orderService.getAdminOrder(id);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function patchAdminStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseParamInt(req.params.id);
    if (Number.isNaN(id)) {
      res.status(404).json({ success: false, message: 'Order not found', errors: null });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const statusStr = typeof b.status === 'string' ? b.status : '';
    if (!['PENDING', 'CONFIRMED', 'SHIPPING', 'DONE', 'CANCELLED'].includes(statusStr)) {
      res.status(400).json({ success: false, message: 'Invalid status', errors: null });
      return;
    }
    const data = await orderService.updateOrderStatus(id, statusStr as OrderStatus);
    res.json(success(data, 'Updated'));
  } catch (err) {
    next(err);
  }
}
