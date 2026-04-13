import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
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

import { errorMiddleware } from './middlewares/error.middleware';
import { dbLoggerMiddleware } from './middlewares/logger.middleware';
import { setupSwagger } from './config/swagger';
import { systemLogRouter } from './modules/system-log/system-log.route';
import { ensureRedisConnected } from './config/redis';
import { cartRouter } from './modules/cart/cart.route';

export const app = express();

/** Allow localhost and 127.0.0.1 (any port) during local development to avoid CORS mismatches. */
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
        cb(null, true);
        return;
      }
      const devLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
      cb(null, devLocal.test(origin));
    },
  })
);
app.use(express.json());
app.use(dbLoggerMiddleware);

setupSwagger(app);

// Best-effort Redis connect at boot (routes may also lazy-connect).
ensureRedisConnected().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Redis connection failed:', err);
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
app.use('/api/system-logs', systemLogRouter);
app.use('/api/cart', cartRouter);

app.use(errorMiddleware);
