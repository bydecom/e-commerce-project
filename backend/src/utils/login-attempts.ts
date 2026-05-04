import { createHash, randomInt } from 'crypto';
import { ensureRedisConnected, redisClient } from '../config/redis';

function envInt(name: string, fallback: number): number {
  const v = parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function getAttemptLimit(): number { return envInt('LOGIN_ATTEMPT_LIMIT', 4); }
function getAttemptTtl(): number   { return envInt('LOGIN_ATTEMPT_TTL_SECONDS', 86400); }
function getOtpTtl(): number       { return envInt('OTP_TTL_SECONDS', 300); }
function getOtpCooldown(): number  { return envInt('OTP_RESEND_COOLDOWN_SECONDS', 60); }

function keyAttempts(email: string): string    { return `login_attempts:${email}`; }
function keyOtp(email: string): string         { return `otp:${email}`; }
function keyOtpCooldown(email: string): string { return `otp_resend_cooldown:${email}`; }

function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export async function getLoginAttempts(email: string): Promise<number> {
  await ensureRedisConnected();
  const val = await redisClient().get(keyAttempts(email));
  return val ? parseInt(val, 10) : 0;
}

export async function incrementLoginAttempts(email: string): Promise<number> {
  await ensureRedisConnected();
  const redis = redisClient();
  const key = keyAttempts(email);
  const count = await redis.incr(key);
  // Set TTL only on first increment — fixes the 24-hour window from first failure
  if (count === 1) {
    await redis.expire(key, getAttemptTtl());
  }
  return count;
}

export async function resetLoginAttempts(email: string): Promise<void> {
  await ensureRedisConnected();
  await redisClient().del(keyAttempts(email));
}

export async function isOtpGateActive(email: string): Promise<boolean> {
  const count = await getLoginAttempts(email);
  return count >= getAttemptLimit();
}

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export async function storeOtp(email: string, otp: string): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  await redis.set(keyOtp(email), hashOtp(otp), { EX: getOtpTtl() });
  await redis.set(keyOtpCooldown(email), '1', { EX: getOtpCooldown() });
}

export async function setOtpResendCooldown(email: string): Promise<void> {
  await ensureRedisConnected();
  await redisClient().set(keyOtpCooldown(email), '1', { EX: getOtpCooldown() });
}

export async function getOtpResendCooldownTtl(email: string): Promise<number> {
  await ensureRedisConnected();
  const ttl = await redisClient().ttl(keyOtpCooldown(email));
  return ttl > 0 ? ttl : 0;
}

export async function checkAndConsumeOtp(email: string, otp: string): Promise<boolean> {
  await ensureRedisConnected();
  const redis = redisClient();
  const stored = await redis.get(keyOtp(email));
  if (!stored) return false;
  if (stored !== hashOtp(otp)) return false;
  await redis.del(keyOtp(email));
  return true;
}

export async function clearOtpKeys(email: string): Promise<void> {
  await ensureRedisConnected();
  await redisClient().del([keyOtp(email), keyOtpCooldown(email)]);
}

/** OTP value TTL in seconds (`OTP_TTL_SECONDS`), for email copy / forgot flow. */
export function getOtpTtlSeconds(): number {
  return getOtpTtl();
}

// ─── Forgot password OTP / reset token ───────────────────────────────────────

function keyForgotOtp(email: string): string {
  return `forgot_otp:${email}`;
}
function keyResetToken(email: string): string {
  return `reset_token:${email}`;
}
function keyForgotCooldown(email: string): string {
  return `forgot_otp_cooldown:${email}`;
}

/** Cooldown for unknown-email path (must match keys read by `getForgotCooldownTtl`). */
export async function setForgotResendCooldown(email: string): Promise<void> {
  await ensureRedisConnected();
  await redisClient().set(keyForgotCooldown(email), '1', { EX: getOtpCooldown() });
}

export async function storeForgotOtp(email: string, otp: string): Promise<void> {
  await ensureRedisConnected();
  const redis = redisClient();
  await redis.set(keyForgotOtp(email), hashOtp(otp), { EX: getOtpTtl() });
  await redis.set(keyForgotCooldown(email), '1', { EX: getOtpCooldown() });
}

export async function getForgotCooldownTtl(email: string): Promise<number> {
  await ensureRedisConnected();
  const ttl = await redisClient().ttl(keyForgotCooldown(email));
  return ttl > 0 ? ttl : 0;
}

export async function checkAndConsumeForgotOtp(email: string, otp: string): Promise<boolean> {
  await ensureRedisConnected();
  const redis = redisClient();
  const stored = await redis.get(keyForgotOtp(email));
  if (!stored || stored !== hashOtp(otp)) return false;
  await redis.del(keyForgotOtp(email));
  return true;
}

export async function storeResetToken(email: string, token: string): Promise<void> {
  await ensureRedisConnected();
  await redisClient().set(keyResetToken(email), token, { EX: 900 });
}

export async function checkAndConsumeResetToken(email: string, token: string): Promise<boolean> {
  await ensureRedisConnected();
  const redis = redisClient();
  const stored = await redis.get(keyResetToken(email));
  if (!stored || stored !== token) return false;
  await redis.del(keyResetToken(email));
  return true;
}

// ─── Change password attempts (per userId) ───────────────────────────────────

function keyChangePasswordAttempts(userId: number): string {
  return `change_password_attempts:${userId}`;
}

export async function isChangePasswordLocked(userId: number): Promise<boolean> {
  await ensureRedisConnected();
  const count = await redisClient().get(keyChangePasswordAttempts(userId));
  return count ? parseInt(count, 10) >= 5 : false;
}

export async function incrementChangePasswordAttempts(userId: number): Promise<number> {
  await ensureRedisConnected();
  const redis = redisClient();
  const key = keyChangePasswordAttempts(userId);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 900);
  return count;
}

export async function resetChangePasswordAttempts(userId: number): Promise<void> {
  await ensureRedisConnected();
  await redisClient().del(keyChangePasswordAttempts(userId));
}
