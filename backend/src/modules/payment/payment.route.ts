import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as vnpayController from './vnpay.controller';

export const paymentRouter = Router();

paymentRouter.post('/vnpay/create', authMiddleware, vnpayController.createPayment);
paymentRouter.post('/vnpay/init', authMiddleware, vnpayController.initCheckout);
paymentRouter.post('/vnpay/pay', authMiddleware, vnpayController.payCheckout);
paymentRouter.post('/vnpay/cancel', authMiddleware, vnpayController.cancelPayment);
paymentRouter.get('/vnpay/verify', vnpayController.verifyReturn);

