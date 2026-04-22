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

async function refreshTtlSeconds(): Promise<number> {
  const ttl = await getConfigInt('refresh_token_ttl_seconds', 604800);
  // Safety bounds: min 60s, max 30 days
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
  const ttl = await refreshTtlSeconds();
  await redisClient().set(redisKey(hashToken(raw)), JSON.stringify(payload), { EX: ttl });
}

/** Validates and rotates the refresh token. Returns new payload+token, or null if invalid/expired. */
export async function rotateRefreshToken(
  raw: string
): Promise<{ payload: RefreshTokenPayload; newRaw: string } | null> {
  await ensureRedisConnected();
  const redis = redisClient();
  const k = redisKey(hashToken(raw));

  const stored = await redis.get(k);
  if (!stored) return null;

  let payload: RefreshTokenPayload;
  try {
    payload = JSON.parse(stored) as RefreshTokenPayload;
  } catch {
    await redis.del(k);
    return null;
  }

  await redis.del(k);
  const newRaw = generateRefreshToken();
  await storeRefreshToken(newRaw, payload);
  return { payload, newRaw };
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  await ensureRedisConnected();
  await redisClient().del(redisKey(hashToken(raw)));
}
