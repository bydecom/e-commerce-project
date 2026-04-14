import { ensureRedisConnected, redisClient } from '../../config/redis';
import { httpError } from '../../utils/http-error';
import { prisma } from '../../db';

export type CartItem = {
  productId: number;
  quantity: number;
  name: string;
};

export type CartPricedItem = CartItem & {
  unitPrice: number;
  lineTotal: number;
};

type StoredCartItem = {
  quantity: number;
  name: string;
};

function cartKey(userId: number): string {
  return `cart:user:${userId}`;
}

function parseProductId(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : NaN;
}

function parseQty(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) ? n : NaN;
}

type CartWriteMode = 'inc' | 'set';

function safeParseStored(raw: string): StoredCartItem | null {
  try {
    const v = JSON.parse(raw) as Partial<StoredCartItem>;
    const quantity = parseQty(v.quantity);
    const name = typeof v.name === 'string' ? v.name : '';
    if (!Number.isFinite(quantity) || quantity <= 0) return null;
    if (!name.trim()) return null;
    return { quantity, name };
  } catch {
    return null;
  }
}

async function withWatchRetry<T>(fn: () => Promise<T>): Promise<T> {
  // Best-effort optimistic concurrency control for Redis updates.
  // eslint-disable-next-line no-plusplus
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // `redis@5` throws an error containing "WATCH" when transaction is aborted.
      if (!msg.toLowerCase().includes('watch')) {
        throw e;
      }
    }
  }
  throw httpError(409, 'Cart was updated concurrently. Please retry.');
}

async function getSellableStock(productId: number): Promise<number> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true, status: true },
  });
  if (!p) throw httpError(404, 'Product not found');
  if (p.status !== 'AVAILABLE') throw httpError(409, 'Product is not available');
  return p.stock;
}

export async function upsertItemWithStock(input: {
  userId: number;
  productId: number;
  quantity: number;
  name: string;
  mode: CartWriteMode;
}): Promise<CartItem> {
  const userId = input.userId;
  const productId = parseProductId(input.productId);
  const quantity = parseQty(input.quantity);
  const name = (input.name || '').trim();

  if (!Number.isFinite(userId) || userId <= 0) throw httpError(400, 'Invalid user');
  if (!Number.isFinite(productId) || productId <= 0) throw httpError(400, 'Invalid productId');
  if (!Number.isFinite(quantity) || quantity < 0) throw httpError(400, 'quantity must be a non-negative integer');
  if (!name) throw httpError(400, 'name is required');
  if (input.mode !== 'inc' && input.mode !== 'set') throw httpError(400, 'Invalid mode');

  await ensureRedisConnected();
  const redis = redisClient();
  const key = cartKey(userId);
  const field = String(productId);

  return withWatchRetry(async () => {
    await redis.watch(key);
    const existingRaw = await redis.hGet(key, field);
    const existing = existingRaw ? safeParseStored(existingRaw) : null;
    const desiredQty = input.mode === 'set' ? quantity : (existing?.quantity ?? 0) + quantity;
    const nextName = name || existing?.name || '';

    const stock = await getSellableStock(productId);
    if (desiredQty > stock) {
      throw httpError(422, 'Insufficient stock', {
        productId,
        availableStock: stock,
        requestedQuantity: desiredQty,
      });
    }

    const tx = redis.multi();
    if (desiredQty <= 0) {
      tx.hDel(key, field);
    } else {
      tx.hSet(key, field, JSON.stringify({ quantity: desiredQty, name: nextName }));
    }
    const res = await tx.exec();
    if (res === null) {
      // Transaction aborted due to WATCH change.
      throw new Error('WATCH conflict');
    }
    return { productId, quantity: desiredQty, name: nextName };
  });
}

export async function getCart(userId: number): Promise<CartItem[]> {
  if (!Number.isFinite(userId) || userId <= 0) throw httpError(400, 'Invalid user');
  await ensureRedisConnected();
  const redis = redisClient();
  const key = cartKey(userId);
  const raw = await redis.hGetAll(key);

  const items: CartItem[] = [];
  for (const [field, value] of Object.entries(raw)) {
    const productId = parseProductId(field);
    const stored = safeParseStored(value);
    if (!Number.isFinite(productId) || productId <= 0) continue;
    if (!stored) continue;
    items.push({ productId, quantity: stored.quantity, name: stored.name });
  }

  items.sort((a, b) => a.productId - b.productId);
  return items;
}

export async function removeItem(input: { userId: number; productId: number }): Promise<{ removed: boolean }> {
  const userId = input.userId;
  const productId = parseProductId(input.productId);
  if (!Number.isFinite(userId) || userId <= 0) throw httpError(400, 'Invalid user');
  if (!Number.isFinite(productId) || productId <= 0) throw httpError(400, 'Invalid productId');

  await ensureRedisConnected();
  const redis = redisClient();
  const key = cartKey(userId);
  const removedCount = await redis.hDel(key, String(productId));
  return { removed: removedCount > 0 };
}

export async function getCartWithPricing(userId: number): Promise<{ items: CartPricedItem[]; total: number }> {
  const items = await getCart(userId);
  if (items.length === 0) return { items: [], total: 0 };

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, price: true },
  });
  const priceById = new Map<number, number>(products.map((p) => [p.id, p.price]));

  const priced: CartPricedItem[] = items.map((i) => {
    const unitPrice = priceById.get(i.productId) ?? 0;
    const lineTotal = unitPrice * i.quantity;
    return { ...i, unitPrice, lineTotal };
  });

  const total = priced.reduce((sum, i) => sum + i.lineTotal, 0);
  return { items: priced, total };
}

