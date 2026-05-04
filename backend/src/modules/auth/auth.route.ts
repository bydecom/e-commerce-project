import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as authController from './auth.controller';

export const authRouter = Router();

const authStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'You have tried too many times. Please try again in 15 minutes to protect your account.',
  },
});

const authOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.',
  },
});

const authRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'System is busy. Please try again later.',
  },
});

authRouter.post('/register', authController.register);
authRouter.post('/forgot-password/request', authOtpLimiter, authController.forgotPasswordRequest);
authRouter.post('/forgot-password/verify', authStrictLimiter, authController.forgotPasswordVerify);
authRouter.post('/forgot-password/reset', authStrictLimiter, authController.forgotPasswordReset);
authRouter.post('/login', authStrictLimiter, authController.login);
authRouter.get('/verify-email', authController.verifyEmail);
authRouter.post('/resend-verification', authStrictLimiter, authController.resendVerification);
authRouter.post('/refresh', authRefreshLimiter, authController.refresh);
authRouter.get('/me', authMiddleware, authController.me);
authRouter.post('/logout', authMiddleware, authController.logout);
authRouter.post('/signout', authController.signout);
authRouter.post('/change-password', authStrictLimiter, authMiddleware, authController.changePassword);
authRouter.post('/otp/request', authOtpLimiter, authController.requestOtp);
authRouter.post('/otp/verify', authOtpLimiter, authController.verifyOtp);
