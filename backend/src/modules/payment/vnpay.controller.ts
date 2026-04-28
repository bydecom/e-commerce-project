import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
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
import { getConfigInt } from '../system-config/system-config.service';

type PaymentTransactionRecord = {
  id?: number;
  orderId?: number;
};

type PaymentTransactionDelegate = {
  findUnique(args: {
    where: { vnp_TxnRef: string };
    select?: { id?: true; orderId?: true };
  }): Promise<PaymentTransactionRecord | null>;
  create(args: {
    data: {
      orderId: number;
      vnp_TxnRef: string;
      vnp_TransactionNo: string | null;
      vnp_Amount: number;
      vnp_BankCode: string | null;
      vnp_PayDate: string | null;
      vnp_ResponseCode: string | null;
      vnp_TransactionStatus: string | null;
      isSuccess: boolean;
      rawQuery: Record<string, string>;
    };
  }): Promise<unknown>;
};

function paymentTransactionClient(client: unknown): PaymentTransactionDelegate {
  return (client as { paymentTransaction: PaymentTransactionDelegate }).paymentTransaction;
}

function getClientIp(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf.length > 0) return String(xf[0]);
  return req.ip || (req.socket?.remoteAddress ?? '127.0.0.1');
}

function parseVnpAmount(rawAmount: string | undefined): number | null {
  if (!rawAmount) return null;
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount / 100;
}

async function resolveOrderIdByTxnRef(txnRef: string): Promise<number | null> {
  const existing = await paymentTransactionClient(prisma).findUnique({
    where: { vnp_TxnRef: txnRef },
    select: { orderId: true },
  });
  if (existing?.orderId) return existing.orderId;

  const completedOrderId = await vnpStore.getCompletedOrderId(txnRef);
  if (completedOrderId) return completedOrderId;

  const pending = await vnpStore.getPendingVnpayCheckout(txnRef);
  if (pending?.orderId) return pending.orderId;

  return (await getReservationPayload(txnRef))?.orderId ?? null;
}

async function getOrderSnapshotByTxnRef(txnRef: string) {
  const orderId = await resolveOrderIdByTxnRef(txnRef);
  if (!orderId) return null;
  return orderService.getAdminOrder(orderId).catch(() => null);
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
    const ttlSeconds = Math.min(
      60 * 60,
      Math.max(60, await getConfigInt('checkout_reservation_ttl_seconds', 900))
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

    const { paymentUrl, vnp_Params } = await vnpay.createVnpayPaymentUrl({
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
    const providedTxnRef = typeof b.txnRef === 'string' ? b.txnRef.trim() : '';
    const shippingAddress = typeof b.shippingAddress === 'string' ? b.shippingAddress.trim() : '';
    if (!shippingAddress) throw httpError(400, 'shippingAddress is required');

    const cartPricing = await cartService.getCartWithPricing(auth.userId);
    if (cartPricing.items.length === 0) throw httpError(422, 'Cart is empty');

    const txnRef = providedTxnRef || `u${auth.userId}-${Date.now()}`;

    const ttlSecondsRaw = (process.env.CHECKOUT_RESERVATION_TTL_SECONDS || '').trim();
    let ttlSeconds = Math.min(60 * 60, Math.max(60, parseInt(ttlSecondsRaw || '900', 10) || 900));
    if (providedTxnRef) {
      const payload = await getReservationPayload(txnRef);
      if (payload?.expiresAtMs) {
        const remaining = Math.ceil((payload.expiresAtMs - Date.now()) / 1000);
        if (Number.isFinite(remaining) && remaining > 0) {
          ttlSeconds = Math.min(ttlSeconds, remaining);
        }
      }
    }

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

export async function reserveCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ success: false, message: 'Unauthorized', errors: null });
      return;
    }

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

    res.json(success({ txnRef, ttlSeconds }, 'OK'));
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
    const { paymentUrl, vnp_Params } = await vnpay.createVnpayPaymentUrl({
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
      await orderService.cancelOrderSystem(orderId).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[cancelPayment] Failed to cancel order:', err);
      });
    }
    await releaseReservationBestEffort(txnRef, pending?.items);
    res.json(success({ cancelled: true, orderId }, 'OK'));
  } catch (err) {
    next(err);
  }
}

export async function vnpayIpn(req: Request, res: Response): Promise<void> {
  try {
    const rawQueryString = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const result = vnpay.verifyVnpayReturn(req.query as Record<string, unknown>, rawQueryString);

    if (!result.isValidSignature) {
      res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
      return;
    }

    const txnRef = result.raw.vnp_TxnRef;
    if (!txnRef) {
      res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
      return;
    }

    const pending = await vnpStore.getPendingVnpayCheckout(txnRef);
    const orderId = await resolveOrderIdByTxnRef(txnRef);
    if (!orderId) {
      res.status(200).json({ RspCode: '01', Message: 'Order not found' });
      return;
    }

    const response = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          userId: true,
          total: true,
          status: true,
          paymentStatus: true,
        },
      });
      if (!order) return { code: '01', message: 'Order not found' } as const;

      const vnpAmount = parseVnpAmount(result.raw.vnp_Amount);
      if (vnpAmount == null || Math.round(order.total) !== Math.round(vnpAmount)) {
        return { code: '04', message: 'Invalid amount' } as const;
      }

      const processed = await paymentTransactionClient(tx).findUnique({
        where: { vnp_TxnRef: txnRef },
        select: { id: true },
      });
      if (processed || order.paymentStatus !== 'PENDING') {
        return { code: '02', message: 'Order already processed' } as const;
      }

      await paymentTransactionClient(tx).create({
        data: {
          orderId: order.id,
          vnp_TxnRef: txnRef,
          vnp_TransactionNo: result.raw.vnp_TransactionNo ?? null,
          vnp_Amount: vnpAmount,
          vnp_BankCode: result.raw.vnp_BankCode ?? null,
          vnp_PayDate: result.raw.vnp_PayDate ?? null,
          vnp_ResponseCode: result.responseCode ?? null,
          vnp_TransactionStatus: result.transactionStatus ?? null,
          isSuccess: result.isSuccess,
          rawQuery: result.raw,
        },
      });

      if (result.isSuccess) {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'PAID' },
        });
        return {
          code: '00',
          message: 'Confirm Success',
          finalized: 'success' as const,
          userId: order.userId,
        };
      }

      const items = await tx.orderItem.findMany({
        where: { orderId: order.id },
        select: { productId: true, quantity: true },
      });
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
      });

      return {
        code: '00',
        message: 'Confirm Success',
        finalized: 'failed' as const,
      };
    });

    if (response.code === '00' && response.finalized === 'success') {
      await cartService.clearCart(response.userId).catch(() => undefined);
      await vnpStore.markCompletedOrderId(txnRef, orderId);
      await releaseReservationBestEffort(txnRef, pending?.items);
    } else if (response.code === '00' && response.finalized === 'failed') {
      await releaseReservationBestEffort(txnRef, pending?.items);
      await vnpStore.markCompletedOrderId(txnRef, orderId).catch(() => undefined);
    }

    res.status(200).json({ RspCode: response.code, Message: response.message });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(200).json({ RspCode: '02', Message: 'Order already processed' });
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[VNPAY IPN Error]:', err);
    res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
  }
}

export async function verifyReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawQueryString = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const result = vnpay.verifyVnpayReturn(req.query as Record<string, unknown>, rawQueryString);
    const txnRef = result.raw.vnp_TxnRef;

    if (txnRef && result.isSuccess) {
      const orderId = await resolveOrderIdByTxnRef(txnRef);
      if (orderId) {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { id: true, userId: true, paymentStatus: true },
        });

        if (order && order.paymentStatus === 'PENDING') {
          const vnpAmount = parseVnpAmount(result.raw.vnp_Amount);
          await prisma.order.update({
            where: { id: orderId },
            data: { paymentStatus: 'PAID' },
          });

          if (vnpAmount != null) {
            void paymentTransactionClient(prisma)
              .create({
                data: {
                  orderId,
                  vnp_TxnRef: txnRef,
                  vnp_TransactionNo: result.raw.vnp_TransactionNo ?? null,
                  vnp_Amount: vnpAmount,
                  vnp_BankCode: result.raw.vnp_BankCode ?? null,
                  vnp_PayDate: result.raw.vnp_PayDate ?? null,
                  vnp_ResponseCode: result.responseCode ?? null,
                  vnp_TransactionStatus: result.transactionStatus ?? null,
                  isSuccess: true,
                  rawQuery: result.raw,
                },
              })
              .catch(() => undefined);
          }

          await cartService.clearCart(order.userId).catch(() => undefined);
          await vnpStore.markCompletedOrderId(txnRef, orderId);
          await releaseReservationBestEffort(txnRef);
        }
      }
    }

    const order = txnRef ? await getOrderSnapshotByTxnRef(txnRef) : null;
    res.json(success({ verify: result, order }, 'OK'));
  } catch (err) {
    next(err);
  }
}

export async function devConfirmPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ success: false, message: 'Not found' });
    return;
  }

  try {
    const { txnRef } = req.body as { txnRef?: string };
    if (!txnRef) throw httpError(400, 'txnRef is required');

    const orderId = await resolveOrderIdByTxnRef(txnRef);
    if (!orderId) throw httpError(404, 'Order not found for this txnRef');

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, paymentStatus: true },
    });
    if (!order) throw httpError(404, 'Order not found');

    if (order.paymentStatus !== 'PENDING') {
      res.json(success({ message: 'Already processed', orderId, paymentStatus: order.paymentStatus }, 'OK'));
      return;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: 'PAID' },
    });
    await cartService.clearCart(order.userId).catch(() => undefined);
    await vnpStore.markCompletedOrderId(txnRef, orderId);
    await releaseReservationBestEffort(txnRef);

    res.json(success({ orderId, paymentStatus: 'PAID' }, 'OK'));
  } catch (err) {
    next(err);
  }
}

