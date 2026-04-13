import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
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
