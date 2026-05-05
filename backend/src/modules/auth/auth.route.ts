import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import * as authController from './auth.controller';
import {
  registerSchema, loginSchema, resendVerificationSchema,
  requestOtpSchema, verifyOtpSchema, changePasswordSchema,
  forgotPasswordRequestSchema, forgotPasswordVerifySchema, forgotPasswordResetSchema,
} from './auth.schema';

export const authRouter = Router();

const authStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
});
const authOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 5,
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
});
const authRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  message: { success: false, message: 'System is busy. Please try again later.' },
});

authRouter.post('/register',                validateBody(registerSchema),                         authController.register);
authRouter.post('/login',                   authStrictLimiter, validateBody(loginSchema),         authController.login);
authRouter.get('/verify-email',             authController.verifyEmail);
authRouter.post('/resend-verification',     authStrictLimiter, validateBody(resendVerificationSchema), authController.resendVerification);
authRouter.post('/refresh',                 authRefreshLimiter, authController.refresh);
authRouter.get('/me',                       authMiddleware, authController.me);
authRouter.post('/logout',                  authMiddleware, authController.logout);
authRouter.post('/signout',                 authController.signout);
authRouter.post('/change-password',         authStrictLimiter, authMiddleware, validateBody(changePasswordSchema), authController.changePassword);
authRouter.post('/otp/request',             authOtpLimiter, validateBody(requestOtpSchema),      authController.requestOtp);
authRouter.post('/otp/verify',              authOtpLimiter, validateBody(verifyOtpSchema),        authController.verifyOtp);
authRouter.post('/forgot-password/request', authOtpLimiter,    validateBody(forgotPasswordRequestSchema), authController.forgotPasswordRequest);
authRouter.post('/forgot-password/verify',  authStrictLimiter, validateBody(forgotPasswordVerifySchema),  authController.forgotPasswordVerify);
authRouter.post('/forgot-password/reset',   authStrictLimiter, validateBody(forgotPasswordResetSchema),   authController.forgotPasswordReset);
