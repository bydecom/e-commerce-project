import bcrypt from 'bcrypt';
import { prisma } from '../../db';
import { httpError } from '../../utils/http-error';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { randomBytes } from 'crypto';
import { ensureRedisConnected, redisClient } from '../../config/redis';
import { sendMail } from '../../utils/mail';
import { blacklistJwt } from '../../utils/jwt-blacklist';
import {
  generateRefreshToken,
  generateTokenFamily,
  storeRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeTokenFamily,
  revokeAllUserRefreshTokens,
} from '../../utils/refresh-token';
import {
  buildExistingAccountAlertTemplate,
  buildPasswordChangedAlertTemplate,
} from '../../utils/mail-templates';
import {
  publishVerifyEmail,
  publishOtpEmail,
  publishForgotEmail,
} from '../../rabbitmq/publisher';
import {
  isOtpGateActive,
  incrementLoginAttempts,
  resetLoginAttempts,
  generateOtp,
  storeOtp,
  setOtpResendCooldown,
  getOtpResendCooldownTtl,
  checkAndConsumeOtp,
  clearOtpKeys,
  storeForgotOtp,
  getForgotCooldownTtl,
  checkAndConsumeForgotOtp,
  storeResetToken,
  checkAndConsumeResetToken,
  getOtpTtlSeconds,
  setForgotResendCooldown,
  isChangePasswordLocked,
  incrementChangePasswordAttempts,
  resetChangePasswordAttempts,
} from '../../utils/login-attempts';
import { StoreSettingService } from '../store-setting/store-setting.service';
import { getConfig, getConfigInt } from '../system-config/system-config.service';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  // Intentionally simple; good enough for basic API validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function mapUser(u: { id: number; name: string | null; email: string; role: 'USER' | 'ADMIN' }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

type PendingRegistration = {
  name: string | null;
  email: string;
  passwordHash: string;
  createdAt: string;
  lastSentAt: string | null;
  resendCount: number;
};

function redisKeyPending(email: string): string {
  return `pending:register:${email}`;
}
function redisKeyToken(token: string): string {
  return `verify:token:${token}`;
}
function redisKeyEmail(email: string): string {
  return `verify:email:${email}`;
}

async function tokenTtlSeconds(): Promise<number> {
  return getConfigInt('verify_token_ttl_seconds', 180);
}

async function pendingTtlSeconds(): Promise<number> {
  return getConfigInt('pending_register_ttl_seconds', 1800);
}

function nowIso(): string {
  return new Date().toISOString();
}

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function verifyLink(token: string): string {
  const fromEnv = (process.env.API_BASE_URL || '').trim();
  const port = process.env.PORT || '3000';
  const devFallback = `http://localhost:${port}`;
  const base =
    fromEnv || (process.env.NODE_ENV !== 'production' ? devFallback : '');
  if (!base) {
    throw httpError(
      500,
      'API_BASE_URL is not configured (set in .env — see backend/.env.example)'
    );
  }
  const url = new URL('/api/auth/verify-email', base);
  url.searchParams.set('token', token);
  return url.toString();
}

async function issueVerificationEmail(email: string, token: string, name: string | null): Promise<void> {
  const ttl = await tokenTtlSeconds();
  const link = verifyLink(token);
  const minutes = Math.max(1, Math.round(ttl / 60));

  const setting = await StoreSettingService.getSetting();
  const shopName = setting?.name?.trim() || 'Shop';

  await publishVerifyEmail({ to: email, name, verifyLink: link, expiresInMinutes: minutes, shopName });
}

// Lazy dummy hash — used so bcrypt.compare always runs even when email doesn't exist,
// preventing timing-based email enumeration. Used by `login`.
let _dummyHash: string | null = null;
async function dummyHash(): Promise<string> {
  if (!_dummyHash) _dummyHash = await bcrypt.hash('__timing_guard__', 10);
  return _dummyHash;
}

export async function register(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const name = input.name?.trim() ? input.name.trim() : null;

  // If user already exists in DB, do not create a pending registration.
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });
  if (existingUser) {
    const setting = await StoreSettingService.getSetting();
    const shopName = setting?.name?.trim() || 'Shop';

    const { subject, html, text } = buildExistingAccountAlertTemplate({
      name: existingUser.name,
      shopName,
    });

    void sendMail({ to: email, subject, text, html }).catch((err) => {
      console.error('[Mail Error] Existing account alert failed:', err);
    });

    // Timing guard: match the cost of the new-user path (bcrypt hash) so
    // response time doesn't reveal whether the email is already registered.
    await bcrypt.hash(password, 10);

    return { email, message: 'Verification email sent' };
  }

  await ensureRedisConnected();
  const redis = redisClient();

  const passwordHash = await bcrypt.hash(password, 10);
  const pending: PendingRegistration = {
    name,
    email,
    passwordHash,
    createdAt: nowIso(),
    lastSentAt: null,
    resendCount: 0,
  };

  // Store pending registration (longer TTL than token).
  await redis.set(redisKeyPending(email), JSON.stringify(pending), { EX: await pendingTtlSeconds() });

  // Issue a verification token (3 minutes) and send email.
  const token = newToken();
  const tokenTtl = await tokenTtlSeconds();
  await redis.set(redisKeyToken(token), email, { EX: tokenTtl });
  await redis.set(redisKeyEmail(email), token, { EX: tokenTtl });

  // Update pending with "sent" bookkeeping.
  pending.lastSentAt = nowIso();
  pending.resendCount = 1;
  await redis.set(redisKeyPending(email), JSON.stringify(pending), { EX: await pendingTtlSeconds() });

  await issueVerificationEmail(email, token, name);

  return { email, message: 'Verification email sent' };
}

async function issueTokens(
  user: { id: number; name: string | null; email: string; role: 'USER' | 'ADMIN' },
  oldRefreshToken?: string,
): Promise<{ token: string; refreshToken: string; user: ReturnType<typeof mapUser> }> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, 'JWT secret is not configured');

  const jti = randomUUID();
  const rawExpiresIn = (await getConfig('jwt_access_expires_in')).trim();
  const expiresIn = (/^\d+$/.test(rawExpiresIn) ? parseInt(rawExpiresIn, 10) : rawExpiresIn) as jwt.SignOptions['expiresIn'];
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    secret,
    { algorithm: 'HS256', expiresIn, subject: String(user.id), jwtid: jti },
  );

  if (oldRefreshToken) {
    await revokeRefreshToken(oldRefreshToken);
  }

  const refreshToken = generateRefreshToken();
  await storeRefreshToken(refreshToken, { userId: user.id, role: user.role, familyId: generateTokenFamily() });

  return { token, refreshToken, user: mapUser(user) };
}

export async function login(input: { email: string; password: string; oldRefreshToken?: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (await isOtpGateActive(email)) {
    throw httpError(403, 'Too many failed attempts. Please verify your identity to continue.', {
      code: 'AUTH_OTP_REQUIRED',
    });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, password: true },
  });

  // Always run bcrypt regardless of whether email exists — prevents timing-based enumeration
  const hashToCheck = user ? user.password : await dummyHash();
  const ok = await bcrypt.compare(password, hashToCheck);

  if (!user || !ok) {
    const newCount = await incrementLoginAttempts(email);
    if (newCount >= 4) {
      throw httpError(403, 'Too many failed attempts. Please verify your identity to continue.', {
        code: 'AUTH_OTP_REQUIRED',
      });
    }
    throw httpError(401, 'Invalid email or password');
  }

  await resetLoginAttempts(email);
  return issueTokens({ id: user.id, name: user.name, email: user.email, role: user.role }, input.oldRefreshToken);
}

export async function requestOtp(input: { email: string }): Promise<void> {
  const email = normalizeEmail(input.email);
  if (!email) throw httpError(400, 'email is required');

  const cooldownTtl = await getOtpResendCooldownTtl(email);
  if (cooldownTtl > 0) {
    throw httpError(429, `Please wait ${cooldownTtl} seconds before requesting another code`);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  const otp = generateOtp();

  if (user) {
    await storeOtp(email, otp);

    const setting = await StoreSettingService.getSetting();
    const shopName = setting?.name?.trim() || 'Shop';
    const expiresInMinutes = Math.max(1, Math.round(parseInt(process.env.OTP_TTL_SECONDS ?? '300', 10) / 60));

    await publishOtpEmail({ to: email, name: user.name, otp, expiresInMinutes, shopName });
  } else {
    // Simulate email send time so response timing doesn't reveal whether email exists
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    await setOtpResendCooldown(email);
  }
}

export async function verifyOtpAndLogin(input: {
  email: string;
  otp: string;
  oldRefreshToken?: string;
}) {
  const email = normalizeEmail(input.email);
  const otp = (input.otp || '').trim();

  if (!email) throw httpError(400, 'email is required');
  if (!otp) throw httpError(400, 'otp is required');

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true },
  });

  const valid = await checkAndConsumeOtp(email, otp);

  if (!user || !valid) {
    if (!user) await new Promise<void>((resolve) => setTimeout(resolve, 200));
    throw httpError(401, 'Invalid or expired verification code');
  }

  await resetLoginAttempts(email);
  await clearOtpKeys(email);

  return issueTokens(user, input.oldRefreshToken);
}

export async function refreshAccessToken(rawRefreshToken: string): Promise<{
  token: string;
  newRefreshToken: string;
}> {
  if (!rawRefreshToken) {
    throw httpError(401, 'Refresh token missing', { code: 'AUTH_REFRESH_INVALID_OR_EXPIRED' });
  }

  const result = await rotateRefreshToken(rawRefreshToken);

  if (result.status === 'reuse_detected') {
    await revokeTokenFamily(result.familyId, result.userId);
    throw httpError(401, 'Refresh token invalid or expired', { code: 'AUTH_REFRESH_REUSE_DETECTED' });
  }

  if (result.status === 'not_found') {
    throw httpError(401, 'Refresh token invalid or expired', { code: 'AUTH_REFRESH_INVALID_OR_EXPIRED' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, 'JWT secret is not configured');

  const { payload, newRaw } = result;
  const rawExpiresIn = (await getConfig('jwt_access_expires_in')).trim();
  const expiresIn = (/^\d+$/.test(rawExpiresIn) ? parseInt(rawExpiresIn, 10) : rawExpiresIn) as jwt.SignOptions['expiresIn'];

  const jti = randomUUID();
  const token = jwt.sign(
    { userId: payload.userId, role: payload.role },
    secret,
    { algorithm: 'HS256', expiresIn, subject: String(payload.userId), jwtid: jti }
  );

  return { token, newRefreshToken: newRaw };
}

export async function verifyEmail(input: { token: string }) {
  const token = (input.token || '').trim();
  if (!token) throw httpError(400, 'token is required');

  await ensureRedisConnected();
  const redis = redisClient();

  const email = await redis.get(redisKeyToken(token));
  if (!email) throw httpError(400, 'Invalid or expired token');

  const pendingRaw = await redis.get(redisKeyPending(email));
  if (!pendingRaw) throw httpError(400, 'Registration is no longer pending');

  let pending: PendingRegistration;
  try {
    pending = JSON.parse(pendingRaw) as PendingRegistration;
  } catch {
    throw httpError(500, 'Corrupted pending registration');
  }

  const u = await prisma.user.create({
    data: {
      email: pending.email,
      password: pending.passwordHash,
      name: pending.name,
      role: 'USER',
    },
    select: { id: true, name: true, email: true, role: true },
  });

  // Cleanup keys (best-effort).
  const latestToken = await redis.get(redisKeyEmail(email));
  const keysToDelete = [redisKeyPending(email), redisKeyEmail(email), redisKeyToken(token)];
  if (latestToken && latestToken !== token) {
    keysToDelete.push(redisKeyToken(latestToken));
  }
  await redis.del(keysToDelete);

  return { user: mapUser(u) };
}

export async function resendVerification(input: { email: string }) {
  const email = normalizeEmail(input.email);
  if (!email) throw httpError(400, 'email is required');
  if (!isValidEmail(email)) throw httpError(400, 'Invalid email');

  // If user already exists, do not resend (treat as no-op).
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { email, message: 'If the account exists, a verification email has been sent' };
  }

  await ensureRedisConnected();
  const redis = redisClient();

  const pendingRaw = await redis.get(redisKeyPending(email));
  if (!pendingRaw) {
    // Generic success response to avoid email enumeration.
    return { email, message: 'If the account exists, a verification email has been sent' };
  }

  let pending: PendingRegistration;
  try {
    pending = JSON.parse(pendingRaw) as PendingRegistration;
  } catch {
    return { email, message: 'If the account exists, a verification email has been sent' };
  }

  const now = Date.now();
  const last = pending.lastSentAt ? Date.parse(pending.lastSentAt) : 0;
  if (last && Number.isFinite(last) && now - last < 30_000) {
    throw httpError(429, 'Please wait before requesting another email');
  }
  if (pending.resendCount >= 5) {
    throw httpError(429, 'Too many resend attempts. Please try again later.');
  }

  // Invalidate old token if present.
  const oldToken = await redis.get(redisKeyEmail(email));
  if (oldToken) {
    await redis.del(redisKeyToken(oldToken));
  }

  const token = newToken();
  const tokenTtl = await tokenTtlSeconds();
  await redis.set(redisKeyToken(token), email, { EX: tokenTtl });
  await redis.set(redisKeyEmail(email), token, { EX: tokenTtl });

  pending.lastSentAt = nowIso();
  pending.resendCount = pending.resendCount + 1;
  await redis.set(redisKeyPending(email), JSON.stringify(pending), { EX: await pendingTtlSeconds() });

  await issueVerificationEmail(email, token, pending.name);

  return { email, message: 'If the account exists, a verification email has been sent' };
}

export async function logoutSession(jti: string, exp: number, rawRefreshToken?: string): Promise<void> {
  await blacklistJwt(jti, exp);
  if (rawRefreshToken) {
    await revokeRefreshToken(rawRefreshToken);
  }
}

export async function getMe(userId: number) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      provinceId: true,
      districtId: true,
      wardId: true,
      streetAddress: true,
      fullAddress: true,
      createdAt: true,
    },
  });
  if (!u) throw httpError(404, 'User not found');
  return u;
}

export async function changePassword(input: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const userId = Math.floor(Number(input.userId));
  if (!Number.isFinite(userId) || userId <= 0) throw httpError(400, 'Invalid user');

  const currentPassword = input.currentPassword ?? '';
  const newPassword = input.newPassword ?? '';

  if (await isChangePasswordLocked(userId)) {
    throw httpError(429, 'Too many failed attempts. Please try again in 15 minutes.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, password: true },
  });
  if (!user) throw httpError(404, 'User not found');

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) {
    await incrementChangePasswordAttempts(userId);
    throw httpError(401, 'Invalid current password');
  }

  await resetChangePasswordAttempts(userId);

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: passwordHash },
  });

  await revokeAllUserRefreshTokens(userId);

  void StoreSettingService.getSetting()
    .then((setting) => {
      const shopName = setting?.name?.trim() || 'Shop';
      const { subject, html, text } = buildPasswordChangedAlertTemplate({ name: user.name, shopName });
      void sendMail({ to: user.email, subject, html, text }).catch((err) => {
        console.error('[Mail Error] Password change alert failed:', err);
      });
    })
    .catch(() => {});
}

export async function requestForgotPasswordOtp(input: { email: string }): Promise<void> {
  const email = normalizeEmail(input.email);
  if (!email) throw httpError(400, 'Email is required');
  if (!isValidEmail(email)) throw httpError(400, 'Invalid email');

  const cooldown = await getForgotCooldownTtl(email);
  if (cooldown > 0) {
    throw httpError(429, `Please wait ${cooldown} seconds before requesting another code`);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true },
  });

  if (!user) {
    await new Promise<void>((r) => setTimeout(r, 800));
    await setForgotResendCooldown(email);
    return;
  }

  const otp = generateOtp();
  await storeForgotOtp(email, otp);

  const setting = await StoreSettingService.getSetting();
  const shopName = setting?.name?.trim() || 'Shop';
  const expiresInMinutes = Math.max(1, Math.round(getOtpTtlSeconds() / 60));

  await publishForgotEmail({ to: email, name: user.name, otp, expiresInMinutes, shopName });
}

export async function verifyForgotPasswordOtp(input: {
  email: string;
  otp: string;
}): Promise<{ resetToken: string }> {
  const email = normalizeEmail(input.email);
  const otp = (input.otp || '').trim();

  if (!email) throw httpError(400, 'Email is required');
  if (!otp) throw httpError(400, 'OTP is required');

  const valid = await checkAndConsumeForgotOtp(email, otp);
  if (!valid) {
    await new Promise<void>((r) => setTimeout(r, 200));
    throw httpError(401, 'Invalid or expired verification code');
  }

  const resetToken = randomUUID();
  await storeResetToken(email, resetToken);
  return { resetToken };
}

export async function resetPassword(input: {
  email: string;
  resetToken: string;
  newPassword: string;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const resetToken = (input.resetToken || '').trim();
  const newPassword = input.newPassword ?? '';

  const valid = await checkAndConsumeResetToken(email, resetToken);
  if (!valid) throw httpError(403, 'Invalid or expired reset session');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw httpError(404, 'User not found');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { email }, data: { password: passwordHash } });

  await revokeAllUserRefreshTokens(user.id);
  await resetLoginAttempts(email);
  await clearOtpKeys(email);
}
