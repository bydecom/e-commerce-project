import { createHash, randomBytes } from 'crypto';
import { ensureRedisConnected, redisClient } from '../config/redis';
import { getConfigInt } from '../modules/system-config/system-config.service';

export interface RefreshTokenPayload {
  userId: number;
  role: 'USER' | 'ADMIN';
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function redisKey(hash: string): string {
  return `refresh:token:${hash}`;
}

function userSessionsKey(userId: number): string {
  return `user:${userId}:sessions`;
}

async function refreshTtlSeconds(): Promise<number> {
  const ttl = await getConfigInt('refresh_token_ttl_seconds', 604800);
  return Math.min(60 * 60 * 24 * 30, Math.max(60, Math.floor(ttl)));
}

export function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export async function storeRefreshToken(
  raw: string,
  payload: RefreshTokenPayload
): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  const ttl = await refreshTtlSeconds();
  const hash = hashToken(raw);
  const expiresAt = Math.floor(Date.now() / 1000) + ttl;
  const userKey = userSessionsKey(payload.userId);

  await redis
    .multi()
    .zRemRangeByScore(userKey, '-inf', Math.floor(Date.now() / 1000)) // dọn rác cũ
    .set(redisKey(hash), JSON.stringify(payload), { EX: ttl })
    .zAdd(userKey, { score: expiresAt, value: hash })
    .expire(userKey, ttl, 'GT')
    .exec();
}

export async function rotateRefreshToken(
  raw: string
): Promise<{ payload: RefreshTokenPayload; newRaw: string } | null> {
  await ensureRedisConnected();
  const redis = redisClient();
  const hash = hashToken(raw);
  const k = redisKey(hash);

  const stored = await redis.get(k);
  if (!stored) return null;

  let payload: RefreshTokenPayload;
  try {
    payload = JSON.parse(stored) as RefreshTokenPayload;
  } catch {
    await redis.del(k);
    return null;
  }

  await revokeRefreshToken(raw);

  const newRaw = generateRefreshToken();
  await storeRefreshToken(newRaw, payload);
  return { payload, newRaw };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  const hash = hashToken(raw);
  const tokenKey = redisKey(hash);

  const stored = await redis.get(tokenKey);
  if (stored) {
    try {
      const payload = JSON.parse(stored) as RefreshTokenPayload;
      await redis
        .multi()
        .zRem(userSessionsKey(payload.userId), hash)
        .del(tokenKey)
        .exec();
      return;
    } catch {}
  }

  await redis.del(tokenKey);
}

export async function revokeAllUserRefreshTokens(userId: number): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  const userKey = userSessionsKey(userId);

  // Lua Script đảm bảo atomic hoàn toàn — không có race condition
  const luaScript = `
    local hashes = redis.call('ZRANGE', KEYS[1], 0, -1)
    for _, hash in ipairs(hashes) do
      redis.call('DEL', 'refresh:token:' .. hash)
    end
    redis.call('DEL', KEYS[1])
    return #hashes
  `;

  await redis.eval(luaScript, { keys: [userKey], arguments: [] });
}