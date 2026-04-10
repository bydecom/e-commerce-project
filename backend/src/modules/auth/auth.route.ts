import { Router } from 'express';
import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
authRouter.get('/verify-email', authController.verifyEmail);
authRouter.post('/resend-verification', authController.resendVerification);
