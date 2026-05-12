import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import { ensureRedisConnected } from './config/redis';
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

const allowedOrigins = [
  'https://d7ozoo9vtkn42.cloudfront.net', // Link CloudFront của ní
  'http://localhost:4200',               // Để còn test Angular ở máy local
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Cho phép các request không có origin (như Postman hoặc thiết bị di động)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy: Thằng này lạ quá, không cho vào!'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true // Quan trọng nếu ní có dùng Cookie hoặc Session
}));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 150 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
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

// Best-effort cleanup loop for expired checkout stock holds.
startReservationCleanupLoop({
  intervalMs: 5_000,
  batchSize: 100,
});

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

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/products', productRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/orders', orderRouter);
app.use('/api/feedbacks', feedbackRouter);
app.use('/api/feedback-types', feedbackTypeRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai', aiRouter);
app.use('/api/store-settings', storeSettingRoute);
app.use('/api/system-config', systemConfigRouter);
app.use('/api/system-logs', systemLogRouter);
app.use('/api/cart', cartRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/locations', locationRouter);
app.use('/api/upload', uploadRouter);

app.use(errorMiddleware);
