import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import * as vnpay from './vnpay.service';
import * as cartService from '../cart/cart.service';
import * as orderService from '../order/order.service';
import * as vnpStore from './vnpay.store';

function getClientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf.length > 0) return String(xf[0]);
  return req.ip || (req.socket?.remoteAddress ?? '127.0.0.1');
}

export async function createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }

    const b = req.body as Record<string, unknown>;
    const shippingAddress = typeof b.shippingAddress === 'string' ? b.shippingAddress.trim() : '';
    const orderInfo =
      typeof b.orderInfo === 'string' && b.orderInfo.trim()
        ? b.orderInfo.trim()
        : `Checkout payment for user ${auth.userId}`;
    const returnUrl = typeof b.returnUrl === 'string' && b.returnUrl.trim() ? b.returnUrl.trim() : undefined;

    if (!shippingAddress) throw httpError(400, 'shippingAddress is required');

    const cartPricing = await cartService.getCartWithPricing(auth.userId);
    if (cartPricing.items.length === 0) throw httpError(422, 'Cart is empty');
    const amountVnd = Math.round(cartPricing.total);
    if (!Number.isFinite(amountVnd) || amountVnd <= 0) throw httpError(400, 'Invalid cart total');

    const txnRef = `u${auth.userId}-${Date.now()}`;
    await vnpStore.putPendingVnpayCheckout(txnRef, {
      userId: auth.userId,
      shippingAddress,
      items: cartPricing.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    const { paymentUrl, vnp_Params } = vnpay.createVnpayPaymentUrl({
      amountVnd,
      ipAddr: getClientIp(req),
      orderInfo,
      returnUrl,
      locale: 'vn',
      txnRef,
    });

    res.json(success({ paymentUrl, vnp_Params }, 'OK'));
  } catch (err) {
    next(err);
  }
}

export async function verifyReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawQueryString = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const result = vnpay.verifyVnpayReturn(req.query as Record<string, unknown>, rawQueryString);
    if (!result.isSuccess) {
      res.json(success({ verify: result, order: null }, 'OK'));
      return;
    }

    const txnRef = result.raw.vnp_TxnRef;
    if (!txnRef) throw httpError(400, 'Missing vnp_TxnRef');

    const completedOrderId = await vnpStore.getCompletedOrderId(txnRef);
    if (completedOrderId) {
      const existing = await orderService.getAdminOrder(completedOrderId).catch(() => null);
      res.json(success({ verify: result, order: existing }, 'OK'));
      return;
    }

    const pending = await vnpStore.consumePendingVnpayCheckout(txnRef);
    if (!pending) throw httpError(409, 'No pending checkout found for this transaction');

    const order = await orderService.createOrder({
      userId: pending.userId,
      items: pending.items,
      shippingAddress: pending.shippingAddress,
    });

    await cartService.clearCart(pending.userId);
    await vnpStore.markCompletedOrderId(txnRef, order.id);

    res.json(success({ verify: result, order }, 'OK'));
  } catch (err) {
    next(err);
  }
}

