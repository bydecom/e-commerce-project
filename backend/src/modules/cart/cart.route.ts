import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as cartController from './cart.controller';

export const cartRouter = Router();

// View current user's cart (Redis-backed).
cartRouter.get('/', authMiddleware, cartController.getMyCart);

// View cart with DB prices + totals (no N+1).
cartRouter.get('/pricing', authMiddleware, cartController.getMyCartWithPricing);

// Add or increment an item in the cart.
cartRouter.put('/items/:productId', authMiddleware, cartController.putCartItem);

// Remove one item from the cart by productId.
cartRouter.delete('/items/:productId', authMiddleware, cartController.deleteCartItem);

