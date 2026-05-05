import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRole } from '../../middlewares/role.middleware';
import { validateBody, validateQuery } from '../../middlewares/validate.middleware';
import { paginationQuerySchema } from '../../utils/pagination-query.schema';
import { createOrderSchema, updateOrderStatusSchema } from './order.schema';
import * as orderController from './order.controller';

export const orderRouter = Router();

orderRouter.post('/',               authMiddleware, validateBody(createOrderSchema), orderController.createOrder);
orderRouter.get('/me',              authMiddleware, validateQuery(paginationQuerySchema), orderController.listMyOrders);
orderRouter.get('/me/:id',          authMiddleware, orderController.getMyOrder);
orderRouter.patch('/me/:id/cancel', authMiddleware, orderController.cancelMyOrder);
orderRouter.get('/',                authMiddleware, requireRole(['ADMIN']), validateQuery(paginationQuerySchema), orderController.listAdminOrders);
orderRouter.get('/:id',             authMiddleware, requireRole(['ADMIN']), orderController.getAdminOrder);
orderRouter.patch('/:id/status',    authMiddleware, requireRole(['ADMIN']), validateBody(updateOrderStatusSchema), orderController.patchAdminStatus);
