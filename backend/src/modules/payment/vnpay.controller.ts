import type { NextFunction, Request, Response } from 'express';
import { success } from '../../utils/response';
import { httpError } from '../../utils/http-error';
import * as vnpay from './vnpay.service';
import * as cartService from '../cart/cart.service';
import * as orderService from '../order/order.service';
import * as vnpStore from './vnpay.store';
import { prisma } from '../../db';
import {
  attachReservationOrderIdBestEffort,
  getReservationPayload,
  reserveStockOrThrow,
  releaseReservationBestEffort,
} from '../inventory/stock-reservation.service';

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

    // Reserve stock at "Checkout" time so only one user can proceed to payment.
    // DB remains the final source of truth when creating the order.
    const ttlSecondsRaw = (process.env.CHECKOUT_RESERVATION_TTL_SECONDS || '').trim();
    const ttlSeconds = Math.min(
      60 * 60,
      Math.max(60, parseInt(ttlSecondsRaw || '900', 10) || 900)
    ); // default 15 minutes, cap 1 hour, min 60s

    const items = cartPricing.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, stock: true, status: true, name: true },
    });
    const stockById = new Map(products.map((p) => [p.id, p.stock]));
    const statusById = new Map(products.map((p) => [p.id, p.status]));
    const nameById = new Map(products.map((p) => [p.id, p.name]));

    for (const it of items) {
      const status = statusById.get(it.productId);
      if (!status) throw httpError(400, `Product ${it.productId} not found`);
      if (status !== 'AVAILABLE') {
        throw httpError(422, `Product "${nameById.get(it.productId) || it.productId}" is not available for sale`);
      }
    }

    await reserveStockOrThrow({
      txnRef,
      items,
      stockByProductId: stockById,
      ttlSeconds,
    });

    // Create a PENDING order immediately (shop will CONFIRM later).
    // If anything fails after reserving, we must revert (cancel + release).
    let orderIdToRevert: number | null = null;
    let orderId: number | null = null;
    try {
      const order = await orderService.createOrder({
        userId: auth.userId,
        items,
        shippingAddress,
      });
      orderIdToRevert = order.id;
      orderId = order.id;
      await attachReservationOrderIdBestEffort(txnRef, order.id);

      await vnpStore.putPendingVnpayCheckout(
        txnRef,
        {
          userId: auth.userId,
          orderId: order.id,
          shippingAddress,
          items: cartPricing.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        },
        ttlSeconds
      );
    } catch (e) {
      if (orderIdToRevert) {
        await orderService.cancelOrderSystem(orderIdToRevert).catch(() => null);
      }
      await releaseReservationBestEffort(txnRef, items);
      throw e;
    }

    const { paymentUrl, vnp_Params } = vnpay.createVnpayPaymentUrl({
      amountVnd,
      ipAddr: getClientIp(req),
      orderInfo,
      returnUrl,
      locale: 'vn',
      txnRef,
    });

    res.json(success({ paymentUrl, vnp_Params, txnRef, orderId }, 'OK'));
  } catch (err) {
    next(err);
  }
}

export async function initCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }

    const b = req.body as Record<string, unknown>;
    const shippingAddress = typeof b.shippingAddress === 'string' ? b.shippingAddress.trim() : '';
    if (!shippingAddress) throw httpError(400, 'shippingAddress is required');

    const cartPricing = await cartService.getCartWithPricing(auth.userId);
    if (cartPricing.items.length === 0) throw httpError(422, 'Cart is empty');

    const txnRef = `u${auth.userId}-${Date.now()}`;

    const ttlSecondsRaw = (process.env.CHECKOUT_RESERVATION_TTL_SECONDS || '').trim();
    const ttlSeconds = Math.min(60 * 60, Math.max(60, parseInt(ttlSecondsRaw || '900', 10) || 900));

    const items = cartPricing.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, stock: true, status: true, name: true },
    });
    const stockById = new Map(products.map((p) => [p.id, p.stock]));
    const statusById = new Map(products.map((p) => [p.id, p.status]));
    const nameById = new Map(products.map((p) => [p.id, p.name]));
    for (const it of items) {
      const status = statusById.get(it.productId);
      if (!status) throw httpError(400, `Product ${it.productId} not found`);
      if (status !== 'AVAILABLE') {
        throw httpError(422, `Product "${nameById.get(it.productId) || it.productId}" is not available for sale`);
      }
    }

    await reserveStockOrThrow({ txnRef, items, stockByProductId: stockById, ttlSeconds });

    let orderIdToRevert: number | null = null;
    try {
      const order = await orderService.createOrder({
        userId: auth.userId,
        items,
        shippingAddress,
      });
      orderIdToRevert = order.id;
      await attachReservationOrderIdBestEffort(txnRef, order.id);
      await vnpStore.putPendingVnpayCheckout(
        txnRef,
        {
          userId: auth.userId,
          orderId: order.id,
          shippingAddress,
          items,
        },
        ttlSeconds
      );
      res.json(success({ txnRef, orderId: order.id, ttlSeconds }, 'OK'));
    } catch (e) {
      if (orderIdToRevert) {
        await orderService.cancelOrderSystem(orderIdToRevert).catch(() => null);
      }
      await releaseReservationBestEffort(txnRef, items);
      throw e;
    }
  } catch (err) {
    next(err);
  }
}

export async function payCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const txnRef = typeof b.txnRef === 'string' ? b.txnRef.trim() : '';
    const orderInfo =
      typeof b.orderInfo === 'string' && b.orderInfo.trim()
        ? b.orderInfo.trim()
        : `Checkout payment for user ${auth.userId}`;
    const returnUrl = typeof b.returnUrl === 'string' && b.returnUrl.trim() ? b.returnUrl.trim() : undefined;
    if (!txnRef) throw httpError(400, 'txnRef is required');

    const pending = await vnpStore.getPendingVnpayCheckout(txnRef);
    const orderId = pending?.orderId ?? (await getReservationPayload(txnRef))?.orderId ?? null;
    if (!pending || !orderId) throw httpError(409, 'No pending checkout found for this transaction');
    if (pending.userId !== auth.userId) throw httpError(403, 'Forbidden');

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, total: true, status: true },
    });
    if (!order || order.userId !== auth.userId) throw httpError(404, 'Order not found');
    if (order.status !== 'PENDING') throw httpError(422, 'Order is not payable');

    const amountVnd = Math.round(order.total);
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

export async function cancelPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const txnRef = typeof b.txnRef === 'string' ? b.txnRef.trim() : '';
    if (!txnRef) throw httpError(400, 'txnRef is required');

    const pending = await vnpStore.consumePendingVnpayCheckout(txnRef);
    const orderId =
      pending?.orderId ??
      (await getReservationPayload(txnRef))?.orderId ??
      null;
    if (orderId) {
      await orderService.cancelOrderSystem(orderId).catch(() => null);
    }
    await releaseReservationBestEffort(txnRef, pending?.items);
    res.json(success({ cancelled: true, orderId }, 'OK'));
  } catch (err) {
    next(err);
  }
}

export async function verifyReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawQueryString = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const result = vnpay.verifyVnpayReturn(req.query as Record<string, unknown>, rawQueryString);
    if (!result.isSuccess) {
      const failTxnRef = result.raw?.vnp_TxnRef;
      if (failTxnRef) {
        const pending = await vnpStore.consumePendingVnpayCheckout(failTxnRef);
        const orderId =
          pending?.orderId ??
          (await getReservationPayload(failTxnRef))?.orderId ??
          null;
        if (orderId) {
          await orderService.cancelOrderSystem(orderId).catch(() => null);
        }
        await releaseReservationBestEffort(failTxnRef, pending?.items);
      }
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

    try {
      const pending = await vnpStore.consumePendingVnpayCheckout(txnRef);
      const orderId =
        pending?.orderId ??
        (await getReservationPayload(txnRef))?.orderId ??
        null;
      if (!orderId) throw httpError(409, 'No pending checkout found for this transaction');

      // Payment success: keep order as PENDING (shop confirms later).
      await cartService.clearCart(pending?.userId ?? 0).catch(() => undefined);
      await vnpStore.markCompletedOrderId(txnRef, orderId);
      await releaseReservationBestEffort(txnRef, pending?.items);

      const order = await orderService.getAdminOrder(orderId).catch(() => null);
      res.json(success({ verify: result, order }, 'OK'));
    } catch (err) {
      // If anything goes wrong here, at least release the hold (order cancellation handled on fail/TTL).
      await releaseReservationBestEffort(txnRef);
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

