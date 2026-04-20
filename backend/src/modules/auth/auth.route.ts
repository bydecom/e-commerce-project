import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.get('/verify-email', authController.verifyEmail);
authRouter.post('/resend-verification', authController.resendVerification);
authRouter.post('/refresh', authController.refresh);
authRouter.get('/me', authMiddleware, authController.me);
authRouter.post('/logout', authMiddleware, authController.logout);
authRouter.post('/change-password', authMiddleware, authController.changePassword);
