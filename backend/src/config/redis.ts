import { createClient } from 'redis';

let _redis: ReturnType<typeof createClient> | null = null;
let _connectPromise: Promise<void> | null = null;

export function redisClient() {
  if (_redis) return _redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is not configured');
  }

  _redis = createClient({ url });
  _redis.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Redis client error:', err);
  });
  return _redis;
}

export async function ensureRedisConnected(): Promise<void> {
  const c = redisClient();
  if (c.isOpen) return;
  if (_connectPromise) {
    await _connectPromise;
    return;
  }

  // `redis@5` connect() resolves to the client type; we normalize to Promise<void>.
  _connectPromise = c
    .connect()
    .then(() => undefined)
    .finally(() => {
      _connectPromise = null;
    });
  await _connectPromise;
}
