import { ensureRedisConnected, redisClient } from '../../config/redis';

export type PendingVnpayCheckout = {
  userId: number;
  orderId: number;
  shippingAddress: string;
  items: Array<{ productId: number; quantity: number }>;
};

function pendingKey(txnRef: string): string {
  return `vnpay:pending:${txnRef}`;
}

function completedKey(txnRef: string): string {
  return `vnpay:completed:${txnRef}`;
}

export async function putPendingVnpayCheckout(
  txnRef: string,
  data: PendingVnpayCheckout,
  ttlSeconds = 60 * 60
): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  await redis.set(pendingKey(txnRef), JSON.stringify(data), { EX: ttlSeconds });
}

export async function getPendingVnpayCheckout(txnRef: string): Promise<PendingVnpayCheckout | null> {
  await ensureRedisConnected();
  const redis = redisClient();
  const raw = await redis.get(pendingKey(txnRef));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingVnpayCheckout;
  } catch {
    return null;
  }
}

export async function consumePendingVnpayCheckout(txnRef: string): Promise<PendingVnpayCheckout | null> {
  await ensureRedisConnected();
  const redis = redisClient();
  const raw = await redis.get(pendingKey(txnRef));
  if (!raw) return null;
  await redis.del(pendingKey(txnRef));
  try {
    return JSON.parse(raw) as PendingVnpayCheckout;
  } catch {
    return null;
  }
}

export async function getCompletedOrderId(txnRef: string): Promise<number | null> {
  await ensureRedisConnected();
  const redis = redisClient();
  const raw = await redis.get(completedKey(txnRef));
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function markCompletedOrderId(
  txnRef: string,
  orderId: number,
  ttlSeconds = 24 * 60 * 60
): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  await redis.set(completedKey(txnRef), String(orderId), { EX: ttlSeconds });
}

