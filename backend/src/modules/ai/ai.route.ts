import { Router } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as aiController from './ai.controller';

export const aiRouter = Router();

aiRouter.post(
  '/enhance-product-description',
  authMiddleware,
  requireRole(['ADMIN']),
  aiController.postEnhanceProductDescription
);

aiRouter.get(
  '/mini-advice',
  authMiddleware,
  requireRole(['ADMIN']),
  aiController.getMiniAdvice
);

// Khách vẫn chat được; nếu gửi Bearer hợp lệ thì optionalAuthMiddleware gắn req.auth (userId) cho add-to-cart / orders.
aiRouter.post('/chat', optionalAuthMiddleware, aiController.postChat);
