import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { upsertCartItemSchema } from './cart.schema';
import * as cartController from './cart.controller';

export const cartRouter = Router();

cartRouter.get('/', authMiddleware, cartController.getMyCart);
cartRouter.get('/pricing', authMiddleware, cartController.getMyCartWithPricing);
cartRouter.put('/items/:productId', authMiddleware, validateBody(upsertCartItemSchema), cartController.putCartItem);
cartRouter.delete('/items/:productId', authMiddleware, cartController.deleteCartItem);
