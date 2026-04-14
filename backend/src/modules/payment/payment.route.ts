import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as vnpayController from './vnpay.controller';

export const paymentRouter = Router();

paymentRouter.post('/vnpay/create', authMiddleware, vnpayController.createPayment);
paymentRouter.get('/vnpay/verify', vnpayController.verifyReturn);

