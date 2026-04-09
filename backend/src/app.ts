import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

import { authRouter } from './modules/auth/auth.route';
import { userRouter } from './modules/user/user.route';
import { productRouter } from './modules/product/product.route';
import { categoryRouter } from './modules/category/category.route';
import { orderRouter } from './modules/order/order.route';
import { feedbackRouter } from './modules/feedback/feedback.route';
import { dashboardRouter } from './modules/dashboard/dashboard.route';
import { aiRouter } from './modules/ai/ai.route';

import { errorMiddleware } from './middlewares/error.middleware';

export const prisma = new PrismaClient();
export const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:4200' }));
app.use(express.json());

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
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai', aiRouter);

app.use(errorMiddleware);
