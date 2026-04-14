import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as paymentController from './stripe.controller';

export const paymentRouter = Router();

paymentRouter.post('/stripe/payment-intent', authMiddleware, paymentController.createStripePaymentIntent);

