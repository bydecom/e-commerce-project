import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import * as orderController from './order.controller';

export const orderRouter = Router();

orderRouter.post('/', authMiddleware, orderController.createOrder);
orderRouter.get('/me', authMiddleware, orderController.listMyOrders);
orderRouter.get('/me/:id', authMiddleware, orderController.getMyOrder);
orderRouter.patch('/me/:id/cancel', authMiddleware, orderController.cancelMyOrder);

orderRouter.get('/', authMiddleware, requireRole(['ADMIN']), orderController.listAdminOrders);
orderRouter.get('/:id', authMiddleware, requireRole(['ADMIN']), orderController.getAdminOrder);
orderRouter.patch('/:id/status', authMiddleware, requireRole(['ADMIN']), orderController.patchAdminStatus);
