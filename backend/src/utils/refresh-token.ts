import { createHash, randomBytes, randomUUID } from 'crypto';
import { ensureRedisConnected, redisClient } from '../config/redis';
import { getConfigInt } from '../modules/system-config/system-config.service';

export interface RefreshTokenPayload {
  userId: number;
  role: 'USER' | 'ADMIN';
  familyId: string;
}

export type RotationResult =
  | { status: 'ok'; payload: RefreshTokenPayload; newRaw: string }
  | { status: 'reuse_detected'; userId: number; familyId: string }
  | { status: 'not_found' };

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function redisKey(hash: string): string {
  return `refresh:token:${hash}`;
}

function userSessionsKey(userId: number): string {
  return `user:${userId}:sessions`;
}

function familyKey(familyId: string): string {
  return `refresh:family:${familyId}`;
}

function usedKey(hash: string): string {
  return `refresh:used:${hash}`;
}

async function refreshTtlSeconds(): Promise<number> {
  const ttl = await getConfigInt('refresh_token_ttl_seconds', 604800);
  return Math.min(60 * 60 * 24 * 30, Math.max(60, Math.floor(ttl)));
}

export function generateRefreshToken(): string {
  return randomBytes(40).toString('hex');
}

export function generateTokenFamily(): string {
  return randomUUID();
}

export async function storeRefreshToken(
  raw: string,
  payload: RefreshTokenPayload,
): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  const ttl = await refreshTtlSeconds();
  const hash = hashToken(raw);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttl;
  const userKey = userSessionsKey(payload.userId);
  const fKey = familyKey(payload.familyId);

  await redis
    .multi()
    .zRemRangeByScore(userKey, '-inf', now)
    .set(redisKey(hash), JSON.stringify(payload), { EX: ttl })
    .zAdd(userKey, { score: expiresAt, value: hash })
    .zAdd(fKey, { score: expiresAt, value: hash })
    .expire(userKey, ttl, 'GT')
    .expire(fKey, ttl, 'GT')
    .exec();
}

/**
 * Atomically rotate a refresh token using a Lua script.
 *
 * The entire check→revoke→issue sequence runs in a single Redis eval, so no
 * two concurrent requests can both succeed with the same token (TOCTOU-safe).
 *
 * After rotating A→B the old hash A is stored as a short-lived tombstone.
 * If any future request presents A again while the tombstone exists, we return
 * `reuse_detected` so the caller can revoke the whole token family.
 *
 * Returns:
 *   { status: 'ok', payload, newRaw }              – rotation succeeded
 *   { status: 'reuse_detected', userId, familyId } – stolen/replayed token
 *   { status: 'not_found' }                        – expired or never existed
 */
export async function rotateRefreshToken(raw: string): Promise<RotationResult> {
  await ensureRedisConnected();
  const redis = redisClient();

  const oldHash = hashToken(raw);
  const newRaw = generateRefreshToken();
  const newHash = hashToken(newRaw);
  const ttl = await refreshTtlSeconds();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ttl;
  // Tombstone lives 24 h max so the reuse-detection window is bounded.
  const usedTtl = Math.min(ttl, 86400);

  // KEYS[1] = refresh:token:{oldHash}
  // KEYS[2] = refresh:used:{oldHash}   (tombstone for reuse detection)
  // KEYS[3] = refresh:token:{newHash}
  //
  // ARGV[1] = oldHash
  // ARGV[2] = newHash
  // ARGV[3] = ttl          (seconds)
  // ARGV[4] = expiresAt    (unix timestamp)
  // ARGV[5] = now          (unix timestamp, for expired-entry cleanup)
  // ARGV[6] = usedTtl      (tombstone TTL in seconds)
  const luaScript = `
    local stored = redis.call('GET', KEYS[1])
    if stored then
      local ok, payload = pcall(cjson.decode, stored)
      if not ok or not payload['familyId'] then
        redis.call('DEL', KEYS[1])
        return {'not_found', false}
      end

      local family_id  = payload['familyId']
      local user_id    = tostring(payload['userId'])
      local sess_key   = 'user:' .. user_id .. ':sessions'
      local fam_key    = 'refresh:family:' .. family_id
      local old_hash   = ARGV[1]
      local new_hash   = ARGV[2]
      local ttl        = tonumber(ARGV[3])
      local expires_at = tonumber(ARGV[4])
      local now        = tonumber(ARGV[5])
      local used_ttl   = tonumber(ARGV[6])

      -- Remove the old token from every index atomically.
      redis.call('DEL', KEYS[1])
      redis.call('ZREM', sess_key, old_hash)
      redis.call('ZREM', fam_key, old_hash)

      -- Issue the new token (same payload JSON, fresh TTL).
      redis.call('SET', KEYS[3], stored, 'EX', ttl)
      redis.call('ZADD', sess_key, expires_at, new_hash)
      redis.call('ZADD', fam_key, expires_at, new_hash)
      redis.call('EXPIRE', sess_key, ttl, 'GT')
      redis.call('EXPIRE', fam_key, ttl, 'GT')
      redis.call('ZREMRANGEBYSCORE', sess_key, '-inf', now)

      -- Leave a tombstone so a later replay of the old token is detectable.
      -- Value encodes "userId:familyId" for the caller to identify the family.
      redis.call('SET', KEYS[2], user_id .. ':' .. family_id, 'EX', used_ttl)

      return {'ok', stored}
    end

    -- Token not in active store — check if it was rotated recently (replay attack).
    local used = redis.call('GET', KEYS[2])
    if used then
      return {'reuse', used}
    end

    return {'not_found', false}
  `;

  const raw_result = (await redis.eval(luaScript, {
    keys: [redisKey(oldHash), usedKey(oldHash), redisKey(newHash)],
    arguments: [
      oldHash,
      newHash,
      String(ttl),
      String(expiresAt),
      String(now),
      String(usedTtl),
    ],
  })) as [string, string | null];

  const [status, data] = raw_result;

  if (status === 'ok' && data) {
    const payload = JSON.parse(data) as RefreshTokenPayload;
    return { status: 'ok', payload, newRaw };
  }

  if (status === 'reuse' && data) {
    // data = "userId:familyId"  (userId has no colon; familyId is a UUID)
    const colonIdx = data.indexOf(':');
    const userId = parseInt(data.slice(0, colonIdx), 10);
    const familyId = data.slice(colonIdx + 1);
    return { status: 'reuse_detected', userId, familyId };
  }

  return { status: 'not_found' };
}

/** Revoke a single refresh token (e.g. on logout). */
export async function revokeRefreshToken(raw: string): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  const hash = hashToken(raw);
  const tokenKey = redisKey(hash);

  const stored = await redis.get(tokenKey);
  if (!stored) return;

  try {
    const payload = JSON.parse(stored) as RefreshTokenPayload;
    await redis
      .multi()
      .zRem(userSessionsKey(payload.userId), hash)
      .zRem(familyKey(payload.familyId), hash)
      .del(tokenKey)
      .exec();
  } catch {
    await redis.del(tokenKey);
  }
}

/**
 * Revoke every token in a token family.
 *
 * Called when reuse is detected: one family = one device session, so we
 * invalidate only that session rather than logging the user out everywhere.
 */
export async function revokeTokenFamily(familyId: string, userId: number): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();

  // KEYS[1] = refresh:family:{familyId}
  // KEYS[2] = user:{userId}:sessions
  const luaScript = `
    local fam_key  = KEYS[1]
    local sess_key = KEYS[2]
    local hashes = redis.call('ZRANGE', fam_key, 0, -1)
    for _, hash in ipairs(hashes) do
      redis.call('DEL', 'refresh:token:' .. hash)
      redis.call('ZREM', sess_key, hash)
    end
    redis.call('DEL', fam_key)
    return #hashes
  `;

  await redis.eval(luaScript, {
    keys: [familyKey(familyId), userSessionsKey(userId)],
    arguments: [],
  });
}

/** Revoke all refresh tokens for a user (password change, account compromise). */
export async function revokeAllUserRefreshTokens(userId: number): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  const userKey = userSessionsKey(userId);

  // KEYS[1] = user:{userId}:sessions
  const luaScript = `
    local hashes = redis.call('ZRANGE', KEYS[1], 0, -1)
    local families = {}
    for _, hash in ipairs(hashes) do
      local data = redis.call('GET', 'refresh:token:' .. hash)
      if data then
        local ok, payload = pcall(cjson.decode, data)
        if ok and payload['familyId'] then
          families[payload['familyId']] = true
        end
      end
      redis.call('DEL', 'refresh:token:' .. hash)
    end
    for fid, _ in pairs(families) do
      redis.call('DEL', 'refresh:family:' .. fid)
    end
    redis.call('DEL', KEYS[1])
    return #hashes
  `;

  await redis.eval(luaScript, { keys: [userKey], arguments: [] });
}
