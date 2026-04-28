import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as vnpayController from './vnpay.controller';

export const paymentRouter = Router();

paymentRouter.post('/vnpay/create', authMiddleware, vnpayController.createPayment);
paymentRouter.post('/vnpay/reserve', authMiddleware, vnpayController.reserveCheckout);
paymentRouter.post('/vnpay/init', authMiddleware, vnpayController.initCheckout);
paymentRouter.post('/vnpay/pay', authMiddleware, vnpayController.payCheckout);
paymentRouter.post('/vnpay/cancel', authMiddleware, vnpayController.cancelPayment);
if (process.env.NODE_ENV !== 'production') {
  paymentRouter.post('/vnpay/dev-confirm', authMiddleware, vnpayController.devConfirmPayment);
}
paymentRouter.get('/vnpay/ipn', vnpayController.vnpayIpn);
paymentRouter.get('/vnpay/verify', vnpayController.verifyReturn);

