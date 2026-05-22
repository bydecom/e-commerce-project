import { ensureRedisConnected, redisClient } from '../config/redis';

function key(jti: string): string {
  return `jwt:blacklist:${jti}`;
}

export async function isJwtBlacklisted(jti: string, exp?: number): Promise<boolean> {
  try {
    await ensureRedisConnected();
    const v = await redisClient().get(key(jti));
    return v !== null;
  } catch (err) {
    console.error('[Blacklist] Redis check failed:', err);
    if (typeof exp === 'number') {
      const remainingMs = exp * 1000 - Date.now();
      if (remainingMs > 5 * 60 * 1000) {
        // Token has more than 5 minutes remaining lifespan.
        // Reject it (Fail-Closed) to prevent long abuse windows.
        console.warn(`[Blacklist] Fail-Closed: Token has ${Math.round(remainingMs / 1000)}s lifespan remaining (> 5m window). Rejecting request.`);
        return true;
      }
    }
    // Fail-Open for tokens close to expiry (< 5 minutes)
    console.warn('[Blacklist] Fail-Open: Token is close to expiry (< 5m). Allowing request.');
    return false;
  }
}

/** Store `jti` until JWT `exp` so the token cannot be reused after logout. */
export async function blacklistJwt(jti: string, expUnixSeconds: number): Promise<void> {
  try {
    await ensureRedisConnected();
    const ttl = expUnixSeconds - Math.floor(Date.now() / 1000);
    if (ttl <= 0) {
      return;
    }
    await redisClient().set(key(jti), '1', { EX: ttl });
  } catch (err) {
    console.error('[Blacklist] Redis store failed, skipping blacklist storage:', err);
  }
}
