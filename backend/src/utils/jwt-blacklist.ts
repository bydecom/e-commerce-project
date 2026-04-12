import { ensureRedisConnected, redisClient } from '../config/redis';

function key(jti: string): string {
  return `jwt:blacklist:${jti}`;
}

export async function isJwtBlacklisted(jti: string): Promise<boolean> {
  await ensureRedisConnected();
  const v = await redisClient().get(key(jti));
  return v !== null;
}

/** Store `jti` until JWT `exp` so the token cannot be reused after logout. */
export async function blacklistJwt(jti: string, expUnixSeconds: number): Promise<void> {
  await ensureRedisConnected();
  const ttl = expUnixSeconds - Math.floor(Date.now() / 1000);
  if (ttl <= 0) {
    return;
  }
  await redisClient().set(key(jti), '1', { EX: ttl });
}
