import { z } from 'zod';

const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number');

export const registerSchema = z.object({
  name:     z.string().max(100).optional(),
  email:    z.string().email('Invalid email format'),
  password: passwordRule,
});

export const loginSchema = z.object({
  email:    z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const requestOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const verifyOtpSchema = z.object({
  email: z.string().email('Invalid email format'),
  otp:   z.string().length(6, 'OTP must be exactly 6 digits'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword:     passwordRule,
}).refine(d => d.newPassword !== d.currentPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

export const forgotPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const forgotPasswordVerifySchema = z.object({
  email: z.string().email('Invalid email format'),
  otp:   z.string().length(6, 'OTP must be exactly 6 digits'),
});

export const forgotPasswordResetSchema = z.object({
  email:       z.string().email('Invalid email format'),
  resetToken:  z.string().min(1, 'Reset token is required'),
  newPassword: passwordRule,
});
