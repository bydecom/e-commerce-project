import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import hpp from 'hpp';
import { prisma } from './db';

import { authRouter } from './modules/auth/auth.route';
import { userRouter } from './modules/user/user.route';
import { productRouter } from './modules/product/product.route';
import { categoryRouter } from './modules/category/category.route';
import { orderRouter } from './modules/order/order.route';
import { feedbackRouter } from './modules/feedback/feedback.route';
import { feedbackTypeRouter } from './modules/feedback/feedback-type.route';
import { dashboardRouter } from './modules/dashboard/dashboard.route';
import { aiRouter } from './modules/ai/ai.route';
import { storeSettingRoute } from './modules/store-setting/store-setting.route';
import { systemConfigRouter } from './modules/system-config/system-config.route';
import { uploadRouter } from './modules/upload/upload.route';

import { errorMiddleware } from './middlewares/error.middleware';
import { dbLoggerMiddleware } from './middlewares/logger.middleware';
import { setupSwagger } from './config/swagger';
import { systemLogRouter } from './modules/system-log/system-log.route';
import { ensureRedisConnected, redisClient } from './config/redis';
import { cartRouter } from './modules/cart/cart.route';
import { paymentRouter } from './modules/payment/payment.route';
import { locationRouter } from './modules/location/location.route';
import { startReservationCleanupLoop } from './modules/inventory/stock-reservation.service';

export const app = express();

// If running behind a reverse proxy (Nginx/Traefik/Cloudflare), set TRUST_PROXY=true
// so `req.protocol` and secure cookies work correctly.
if (String(process.env.TRUST_PROXY ?? '').toLowerCase() === 'true') {
  app.set('trust proxy', 1);
}

app.use(helmet());

// 1. Khai báo danh sách các domain được phép gọi vào API
const allowedOrigins = [
  process.env.CLIENT_URL ? process.env.CLIENT_URL.trim().replace(/\/$/, '') : null, // Link Production (CloudFront, strip trailing slash)
  'http://localhost:4200',               // Link Local (Angular)
  'http://localhost:3000'                // Đôi khi cần cho Swagger/Postman
].filter(Boolean);

// 2. Kích hoạt Middleware CORS
app.use(cors({
  origin: function (origin, callback) {
    // Cho phép các request không có origin (như Postman hoặc Mobile App)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log ra để biết thằng nào đang bị chặn nếu cần debug
      console.warn(`CORS blocked for origin: ${origin}`);
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true // BẮT BUỘC phải là true vì bác đang dùng Cookie/Refresh Token
}));

// ─── 1.4 Rate Limit with Redis Store ────────────────────────────────────────
// MemoryStore = each PM2 cluster instance has its own counter.
// 4 instances → user can send 150 × 4 = 600 requests. Rate limit becomes meaningless.
// RedisStore shares a single counter across all cluster instances.
// In dev/test, fall back to in-memory (no Redis dependency needed for local dev).
//
// IMPORTANT: RedisStore calls sendCommand() immediately when rateLimit processes
// the first request. If Redis isn't connected yet, sendCommand() throws
// "ClientClosedError". We solve this by ensuring the sendCommand adapter calls
// ensureRedisConnected() lazily — the first request triggers the connection,
// and subsequent calls reuse the open client.
// ─────────────────────────────────────────────────────────────────────────────
function createRateLimitStore(): RedisStore | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined; // MemoryStore default for dev
  try {
    return new RedisStore({
      // rate-limit-redis calls sendCommand for every request.
      // We wrap it to lazily ensure Redis is connected first.
      sendCommand: async (...args: string[]) => {
        await ensureRedisConnected();
        return redisClient().sendCommand(args);
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[RateLimit] Failed to create RedisStore, falling back to MemoryStore:', err);
    return undefined;
  }
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 150 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore(),
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') {
      return true;
    }

    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  },
  message: {
    success: false,
    message: 'System is busy. Please try again later.',
  },
});

const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // Max 10 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore(),
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') return true;
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  },
  message: {
    success: false,
    message: 'Too many AI requests. Please wait a moment before trying again.',
  },
});

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: process.env.NODE_ENV === 'production' ? 20 : 100, // Max 20 authentication attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore(),
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') return true;
    const ip = req.ip || req.socket.remoteAddress || '';
    return ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1';
  },
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again later.',
  },
});
app.use('/api', globalLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(hpp());
app.use(cookieParser());
app.use(dbLoggerMiddleware);

setupSwagger(app);

// Best-effort Redis connect at boot (routes may also lazy-connect).
ensureRedisConnected().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Redis connection failed:', err);
});

// ─── 1.5 Cleanup Loop with Distributed Lock ────────────────────────────────
// The cleanup loop runs every 5s to release expired checkout stock holds.
// In Cluster Mode (4+ instances), ALL instances would run this loop simultaneously,
// causing duplicate DB queries and race conditions.
// Solution: The loop now acquires a Redis distributed lock (SETNX) before running.
// Only the instance that wins the lock executes the cleanup; others skip that tick.
// ─────────────────────────────────────────────────────────────────────────────
let _cleanupHandle: { stop: () => void } | null = null;

_cleanupHandle = startReservationCleanupLoop({
  intervalMs: 5_000,
  batchSize: 100,
});

/** Called by index.ts during graceful shutdown to stop the cleanup interval. */
export function stopCleanupLoop(): void {
  if (_cleanupHandle) {
    _cleanupHandle.stop();
    _cleanupHandle = null;
  }
}

const success = (data: unknown, message = 'OK', meta: unknown = null) => ({
  success: true,
  message,
  data,
  meta,
});

app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json(success(null, 'Server and database are running.'));
  } catch (error) {
    res.status(500).json({ success: false, message: 'Database connection failed', error });
  }
});

app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api/users', userRouter);
app.use('/api/products', productRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/orders', orderRouter);
app.use('/api/feedbacks', feedbackRouter);
app.use('/api/feedback-types', feedbackTypeRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai', aiRateLimiter, aiRouter);
app.use('/api/store-settings', storeSettingRoute);
app.use('/api/system-config', systemConfigRouter);
app.use('/api/system-logs', systemLogRouter);
app.use('/api/cart', cartRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/locations', locationRouter);
app.use('/api/upload', uploadRouter);

app.use(errorMiddleware);
