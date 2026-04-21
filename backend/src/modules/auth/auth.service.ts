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
  storeRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../../utils/refresh-token';
import { buildVerifyEmailTemplate } from '../../utils/mail-templates';
import { StoreSettingService } from '../store-setting/store-setting.service';

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

function tokenTtlSeconds(): number {
  const raw = process.env.VERIFY_TOKEN_TTL_SECONDS?.trim();
  if (!raw) return 180;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw httpError(500, 'VERIFY_TOKEN_TTL_SECONDS must be a positive number');
  return Math.floor(n);
}

function pendingTtlSeconds(): number {
  const raw = process.env.PENDING_REGISTER_TTL_SECONDS?.trim();
  if (!raw) return 1800; // 30 minutes
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw httpError(500, 'PENDING_REGISTER_TTL_SECONDS must be a positive number');
  return Math.floor(n);
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
  const ttl = tokenTtlSeconds();
  const link = verifyLink(token);
  const minutes = Math.max(1, Math.round(ttl / 60));

  const setting = await StoreSettingService.getSetting();
  const shopName = setting?.name?.trim() || 'Shop';

  const { subject, html, text } = buildVerifyEmailTemplate({
    name,
    verifyLink: link,
    expiresInMinutes: minutes,
    shopName,
  });

  await sendMail({
    to: email,
    subject,
    text,
    html,
  });
}

export async function register(input: { name: string; email: string; password: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const name = input.name?.trim() ? input.name.trim() : null;

  if (!email) throw httpError(400, 'email is required');
  if (!isValidEmail(email)) throw httpError(400, 'Invalid email');
  if (!password) throw httpError(400, 'password is required');
  if (password.length < 6) throw httpError(400, 'Password must be at least 6 characters');

  // If user already exists in DB, do not create a pending registration.
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) throw httpError(409, 'Email already exists');

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
  await redis.set(redisKeyPending(email), JSON.stringify(pending), { EX: pendingTtlSeconds() });

  // Issue a verification token (3 minutes) and send email.
  const token = newToken();
  await redis.set(redisKeyToken(token), email, { EX: tokenTtlSeconds() });
  await redis.set(redisKeyEmail(email), token, { EX: tokenTtlSeconds() });

  // Update pending with "sent" bookkeeping.
  pending.lastSentAt = nowIso();
  pending.resendCount = 1;
  await redis.set(redisKeyPending(email), JSON.stringify(pending), { EX: pendingTtlSeconds() });

  await issueVerificationEmail(email, token, name);

  return { email, message: 'Verification email sent' };
}

export async function login(input: { email: string; password: string; oldRefreshToken?: string }) {
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!email) throw httpError(400, 'email is required');
  if (!password) throw httpError(400, 'password is required');

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, password: true },
  });
  if (!user) throw httpError(401, 'Email or Password wrong');

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw httpError(401, 'Email or Password wrong');

  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, 'JWT secret is not configured');

  const jti = randomUUID();
  const expiresIn = (
    process.env.JWT_ACCESS_EXPIRES_IN ||
    '15m'
  ).trim() as jwt.SignOptions['expiresIn'];
  const token = jwt.sign(
    { userId: user.id, role: user.role },
    secret,
    {
      algorithm: 'HS256',
      expiresIn,
      subject: String(user.id),
      jwtid: jti,
    }
  );

  if (input.oldRefreshToken) {
    await revokeRefreshToken(input.oldRefreshToken);
  }

  const refreshToken = generateRefreshToken();
  await storeRefreshToken(refreshToken, { userId: user.id, role: user.role });

  return {
    token,
    refreshToken,
    user: mapUser({ id: user.id, name: user.name, email: user.email, role: user.role }),
  };
}

export async function refreshAccessToken(rawRefreshToken: string): Promise<{
  token: string;
  newRefreshToken: string;
}> {
  if (!rawRefreshToken) {
    throw httpError(401, 'Refresh token missing', { code: 'AUTH_REFRESH_INVALID_OR_EXPIRED' });
  }

  const result = await rotateRefreshToken(rawRefreshToken);
  if (!result) {
    throw httpError(401, 'Refresh token invalid or expired', { code: 'AUTH_REFRESH_INVALID_OR_EXPIRED' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw httpError(500, 'JWT secret is not configured');

  const { payload, newRaw } = result;
  const expiresIn = (
    process.env.JWT_ACCESS_EXPIRES_IN ||
    '15m'
  ).trim() as jwt.SignOptions['expiresIn'];

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
  await redis.set(redisKeyToken(token), email, { EX: tokenTtlSeconds() });
  await redis.set(redisKeyEmail(email), token, { EX: tokenTtlSeconds() });

  pending.lastSentAt = nowIso();
  pending.resendCount = pending.resendCount + 1;
  await redis.set(redisKeyPending(email), JSON.stringify(pending), { EX: pendingTtlSeconds() });

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

  if (!currentPassword) throw httpError(400, 'currentPassword is required');
  if (!newPassword) throw httpError(400, 'newPassword is required');
  if (newPassword.length < 6) throw httpError(400, 'Password must be at least 6 characters');
  if (newPassword === currentPassword) throw httpError(400, 'New password must be different');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });
  if (!user) throw httpError(404, 'User not found');

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw httpError(401, 'Invalid current password');

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: passwordHash },
  });
}
