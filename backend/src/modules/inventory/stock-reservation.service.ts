import { ensureRedisConnected, redisClient } from '../../config/redis';
import { httpError } from '../../utils/http-error';
import * as orderService from '../order/order.service';

export type ReservationItem = { productId: number; quantity: number };

export type ReservationFailureReason = 'OUT_OF_STOCK' | 'TEMPORARILY_HELD';
export type ReservationFailureItem = {
  productId: number;
  requestedQuantity: number;
  availableStock: number;
  holdTtlSeconds?: number;
};

type ReserveInput = {
  txnRef: string;
  items: ReservationItem[];
  /** DB stock snapshot at reservation time */
  stockByProductId: Map<number, number>;
  ttlSeconds: number;
  nowMs?: number;
};

const HOLD_KEY_PREFIX = 'stock:hold:txn:'; // JSON payload
const HOLD_EXP_ZSET = 'stock:hold:exp'; // score = expiresAtMs, member = txnRef
const HOLD_COUNTER_PREFIX = 'stock:hold:qty:'; // integer reserved qty per productId

function holdKey(txnRef: string) {
  return `${HOLD_KEY_PREFIX}${txnRef}`;
}

function productHoldCounterKey(productId: number) {
  return `${HOLD_COUNTER_PREFIX}${productId}`;
}

export type ReservationPayload = {
  txnRef: string;
  expiresAtMs: number;
  items: ReservationItem[];
  orderId?: number;
};

const RESERVE_LUA = `
-- KEYS:
-- 1) zsetKey (stock:hold:exp)
-- 2) holdKey (stock:hold:txn:<txnRef>)
-- 3..N) per-product counter keys (stock:hold:qty:<productId>)
--
-- ARGV:
-- 1) txnRef
-- 2) expiresAtMs
-- 3) holdJson
-- then for each product in the same order as counter keys:
--   qty_i, dbStock_i

local zsetKey = KEYS[1]
local holdKey = KEYS[2]
local txnRef = ARGV[1]
local expiresAt = tonumber(ARGV[2])
local holdJson = ARGV[3]

-- Idempotency: if already reserved, treat as success
if redis.call('EXISTS', holdKey) == 1 then
  return 1
end

local keyCount = #KEYS
local productCount = keyCount - 2
local baseArg = 4

-- Validate availability against current holds + DB stock snapshot
for i = 1, productCount do
  local counterKey = KEYS[2 + i]
  local qty = tonumber(ARGV[baseArg + (i - 1) * 2])
  local dbStock = tonumber(ARGV[baseArg + (i - 1) * 2 + 1])
  if (not qty) or qty <= 0 then
    return redis.error_reply('invalid_qty')
  end
  if (not dbStock) or dbStock < 0 then
    return redis.error_reply('invalid_stock')
  end
  local current = tonumber(redis.call('GET', counterKey) or '0')
  if current + qty > dbStock then
    -- Return detail so API can show better UX:
    -- { 0, failingIndex(1-based), currentHoldQty, dbStockSnapshot, requestedQty }
    return { 0, i, current, dbStock, qty }
  end
end

-- Apply reservation
for i = 1, productCount do
  local counterKey = KEYS[2 + i]
  local qty = tonumber(ARGV[baseArg + (i - 1) * 2])
  redis.call('INCRBY', counterKey, qty)
end

redis.call('SET', holdKey, holdJson)
redis.call('ZADD', zsetKey, expiresAt, txnRef)
return 1
`;

const RELEASE_LUA = `
-- KEYS:
-- 1) zsetKey
-- 2) holdKey
-- 3..N) per-product counter keys (same productIds as stored in holdJson)
--
-- ARGV:
-- 1) txnRef

local zsetKey = KEYS[1]
local holdKey = KEYS[2]
local txnRef = ARGV[1]

local raw = redis.call('GET', holdKey)
if not raw then
  redis.call('ZREM', zsetKey, txnRef)
  return 0
end

local ok, parsed = pcall(cjson.decode, raw)
if (not ok) or (not parsed) or (not parsed.items) then
  redis.call('DEL', holdKey)
  redis.call('ZREM', zsetKey, txnRef)
  return 0
end

local items = parsed.items
-- Decrement counters using KEYS provided (order must match items order)
for i = 1, #items do
  local counterKey = KEYS[2 + i]
  local qty = tonumber(items[i].quantity) or 0
  if qty > 0 then
    local next = redis.call('DECRBY', counterKey, qty)
    if tonumber(next) <= 0 then
      redis.call('DEL', counterKey)
    end
  end
end

redis.call('DEL', holdKey)
redis.call('ZREM', zsetKey, txnRef)
return 1
`;

export async function reserveStockOrThrow(input: ReserveInput): Promise<void> {
  const txnRef = String(input.txnRef || '').trim();
  if (!txnRef) throw httpError(400, 'Invalid transaction reference');
  if (!Array.isArray(input.items) || input.items.length === 0) throw httpError(400, 'items is required');

  const ttlSeconds = Math.floor(Number(input.ttlSeconds));
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) throw httpError(400, 'Invalid ttlSeconds');

  const nowMs = Number.isFinite(input.nowMs) ? Math.floor(input.nowMs as number) : Date.now();
  const expiresAtMs = nowMs + ttlSeconds * 1000;

  // Normalize & validate items, preserve order deterministically.
  const items: ReservationItem[] = input.items.map((it) => ({
    productId: Math.floor(Number(it.productId)),
    quantity: Math.floor(Number(it.quantity)),
  }));
  for (const it of items) {
    if (!Number.isFinite(it.productId) || it.productId < 1) throw httpError(400, 'Invalid productId');
    if (!Number.isFinite(it.quantity) || it.quantity < 1) throw httpError(400, 'Invalid quantity');
    const dbStock = input.stockByProductId.get(it.productId);
    if (dbStock === undefined) throw httpError(400, 'Missing stock snapshot for product');
    if (it.quantity > dbStock) {
      throw httpError(422, 'Insufficient stock', {
        productId: it.productId,
        availableStock: dbStock,
        requestedQuantity: it.quantity,
      });
    }
  }

  await ensureRedisConnected();
  const redis = redisClient();

  const holdPayload = JSON.stringify({
    txnRef,
    expiresAtMs,
    items,
  });

  const counterKeys = items.map((it) => productHoldCounterKey(it.productId));
  const keys = [HOLD_EXP_ZSET, holdKey(txnRef), ...counterKeys];

  const args: string[] = [txnRef, String(expiresAtMs), holdPayload];
  for (const it of items) {
    const dbStock = input.stockByProductId.get(it.productId) ?? 0;
    args.push(String(it.quantity), String(dbStock));
  }

  const result = await redis.eval(RESERVE_LUA, { keys, arguments: args });
  if (result === 1) return;

  // Node-redis may return either a number or an array for Lua multi-bulk replies.
  const failure = Array.isArray(result) ? result : null;
  if (!failure || failure.length < 5) {
    throw httpError(422, 'Insufficient stock', {
      reason: 'OUT_OF_STOCK' satisfies ReservationFailureReason,
      items: items.map((it) => ({
        productId: it.productId,
        requestedQuantity: it.quantity,
        availableStock: Math.max(0, input.stockByProductId.get(it.productId) ?? 0),
      })) satisfies ReservationFailureItem[],
    });
  }

  const failingIndex = Math.floor(Number(failure[1]));
  const currentHoldQty = Math.max(0, Math.floor(Number(failure[2])));
  const dbStockSnapshot = Math.max(0, Math.floor(Number(failure[3])));
  const requestedQty = Math.max(0, Math.floor(Number(failure[4])));

  const it = items[Math.max(0, failingIndex - 1)];
  const productId = it?.productId ?? items[0]?.productId ?? 0;
  const availableStock = Math.max(0, dbStockSnapshot - currentHoldQty);

  const reason: ReservationFailureReason =
    availableStock <= 0 && dbStockSnapshot > 0 && currentHoldQty > 0 ? 'TEMPORARILY_HELD' : 'OUT_OF_STOCK';

  const status = reason === 'TEMPORARILY_HELD' ? 409 : 422;
  const holdTtlSeconds = Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));

  throw httpError(status, 'Insufficient stock', {
    reason,
    items: [
      {
        productId,
        requestedQuantity: requestedQty || it?.quantity || 0,
        availableStock,
        ...(reason === 'TEMPORARILY_HELD' ? { holdTtlSeconds } : null),
      },
    ] satisfies ReservationFailureItem[],
  });
}

export async function attachReservationOrderIdBestEffort(txnRef: string, orderId: number): Promise<void> {
  const ref = String(txnRef || '').trim();
  const oid = Math.floor(Number(orderId));
  if (!ref || !Number.isFinite(oid) || oid < 1) return;
  await ensureRedisConnected();
  const redis = redisClient();
  const raw = await redis.get(holdKey(ref));
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as ReservationPayload;
    const next = { ...parsed, orderId: oid };
    await redis.set(holdKey(ref), JSON.stringify(next));
  } catch {
    // ignore
  }
}

export async function getReservationPayload(txnRef: string): Promise<ReservationPayload | null> {
  const ref = String(txnRef || '').trim();
  if (!ref) return null;
  await ensureRedisConnected();
  const redis = redisClient();
  const raw = await redis.get(holdKey(ref));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReservationPayload;
  } catch {
    return null;
  }
}

export async function releaseReservationBestEffort(txnRef: string, itemsHint?: ReservationItem[]): Promise<void> {
  const ref = String(txnRef || '').trim();
  if (!ref) return;
  await ensureRedisConnected();
  const redis = redisClient();

  // If caller supplies item list, we can pass correct KEYS count; otherwise try a cheap read.
  let items: ReservationItem[] | null = null;
  if (itemsHint && itemsHint.length) {
    items = itemsHint.map((it) => ({
      productId: Math.floor(Number(it.productId)),
      quantity: Math.floor(Number(it.quantity)),
    }));
  } else {
    const raw = await redis.get(holdKey(ref));
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { items?: ReservationItem[] };
        if (Array.isArray(parsed.items)) items = parsed.items;
      } catch {
        // ignore
      }
    }
  }
  if (!items || items.length === 0) {
    // Still remove zset marker, and delete malformed hold key if any.
    await redis.del(holdKey(ref)).catch(() => undefined);
    await redis.zRem(HOLD_EXP_ZSET, ref).catch(() => undefined);
    return;
  }

  const counterKeys = items.map((it) => productHoldCounterKey(it.productId));
  const keys = [HOLD_EXP_ZSET, holdKey(ref), ...counterKeys];
  await redis.eval(RELEASE_LUA, { keys, arguments: [ref] }).catch(() => undefined);
}

export function startReservationCleanupLoop(opts?: {
  intervalMs?: number;
  batchSize?: number;
}): { stop: () => void } {
  const intervalMs = Math.max(2_000, Math.floor(opts?.intervalMs ?? 5_000));
  const batchSize = Math.max(10, Math.floor(opts?.batchSize ?? 50));

  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    void (async () => {
      try {
        await ensureRedisConnected();
        const redis = redisClient();
        const now = Date.now();
        const expired = await redis.zRangeByScore(HOLD_EXP_ZSET, 0, now, {
          LIMIT: { offset: 0, count: batchSize },
        });
        if (!expired.length) return;
        for (const txnRef of expired) {
          // TTL expiry: cancel PENDING order + restore DB stock + release reservation.
          // eslint-disable-next-line no-await-in-loop
          const payload = await getReservationPayload(txnRef);
          if (payload?.orderId) {
            // eslint-disable-next-line no-await-in-loop
            await orderService.cancelOrderSystem(payload.orderId).catch(() => null);
          }
          // eslint-disable-next-line no-await-in-loop
          await releaseReservationBestEffort(txnRef, payload?.items);
        }
      } catch {
        // Best-effort; do not crash the process if Redis is down.
      }
    })();
  }, intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}

export function getReservationKeysForDebug(txnRef: string) {
  return {
    holdKey: `${HOLD_KEY_PREFIX}${txnRef}`,
    expZset: HOLD_EXP_ZSET,
  };
}

