import { Router } from 'express';
import * as orderController from './order.controller';

export const orderRouter = Router();

/** POST /orders — body: { userId, items, shippingAddress } (userId bắt buộc khi chưa có JWT). */
orderRouter.post('/', orderController.createOrder);

/** GET/PATCH /orders/me* — query userId bắt buộc khi chưa có JWT. */
orderRouter.get('/me', orderController.listMyOrders);
orderRouter.get('/me/:id', orderController.getMyOrder);
orderRouter.patch('/me/:id/cancel', orderController.cancelMyOrder);

/** Admin: GET /orders, GET /orders/:id, PATCH /orders/:id/status */
orderRouter.get('/', orderController.listAdminOrders);
orderRouter.get('/:id', orderController.getAdminOrder);
orderRouter.patch('/:id/status', orderController.patchAdminStatus);
