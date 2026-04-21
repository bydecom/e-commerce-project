import { createHash, randomBytes } from 'crypto';
import { ensureRedisConnected, redisClient } from '../config/redis';

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

function refreshTtlSeconds(): number {
  const raw = process.env.REFRESH_TOKEN_TTL_SECONDS?.trim();
  if (!raw) return 604800; // 7 days
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 604800;
  return Math.floor(n);
}

export function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export async function storeRefreshToken(
  raw: string,
  payload: RefreshTokenPayload
): Promise<void> {
  await ensureRedisConnected();
  const ttl = refreshTtlSeconds();
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
