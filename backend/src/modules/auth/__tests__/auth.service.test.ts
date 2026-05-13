// Mock tất cả external dependencies trước khi import
jest.mock('../../../db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../../../config/redis', () => ({
  ensureRedisConnected: jest.fn().mockResolvedValue(undefined),
  redisClient: jest.fn().mockReturnValue({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  }),
}));

jest.mock('../../../utils/mail', () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/login-attempts', () => ({
  isOtpGateActive: jest.fn().mockResolvedValue(false),
  incrementLoginAttempts: jest.fn().mockResolvedValue(1),
  resetLoginAttempts: jest.fn().mockResolvedValue(undefined),
  generateOtp: jest.fn().mockReturnValue('123456'),
  storeOtp: jest.fn().mockResolvedValue(undefined),
  setOtpResendCooldown: jest.fn().mockResolvedValue(undefined),
  getOtpResendCooldownTtl: jest.fn().mockResolvedValue(0),
  checkAndConsumeOtp: jest.fn().mockResolvedValue(true),
  clearOtpKeys: jest.fn().mockResolvedValue(undefined),
  storeForgotOtp: jest.fn().mockResolvedValue(undefined),
  getForgotCooldownTtl: jest.fn().mockResolvedValue(0),
  checkAndConsumeForgotOtp: jest.fn().mockResolvedValue(true),
  storeResetToken: jest.fn().mockResolvedValue(undefined),
  checkAndConsumeResetToken: jest.fn().mockResolvedValue(true),
  getOtpTtlSeconds: jest.fn().mockReturnValue(300),
  setForgotResendCooldown: jest.fn().mockResolvedValue(undefined),
  isChangePasswordLocked: jest.fn().mockResolvedValue(false),
  incrementChangePasswordAttempts: jest.fn().mockResolvedValue(1),
  resetChangePasswordAttempts: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/refresh-token', () => ({
  generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
  generateTokenFamily: jest.fn().mockReturnValue('mock-family-id'),
  storeRefreshToken: jest.fn().mockResolvedValue(undefined),
  rotateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  revokeTokenFamily: jest.fn().mockResolvedValue(undefined),
  revokeAllUserRefreshTokens: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../store-setting/store-setting.service', () => ({
  StoreSettingService: {
    getSetting: jest.fn().mockResolvedValue({ name: 'BanDai Shop' }),
  },
}));

jest.mock('../../system-config/system-config.service', () => ({
  getConfig: jest.fn().mockResolvedValue('840'),
  getConfigInt: jest.fn().mockResolvedValue(180),
}));

jest.mock('../../../utils/jwt-blacklist', () => ({
  blacklistJwt: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../../db';
import { login, register } from '../auth.service';
import bcrypt from 'bcrypt';

const mockPrismaUser = prisma.user as jest.Mocked<typeof prisma.user>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-for-jest';
    process.env.API_BASE_URL = 'http://localhost:3000';
  });

  // ── LOGIN ──────────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('should return token + refreshToken khi email/password đúng', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        password: hash,
      } as any);

      const result = await login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('USER');
    });

    it('should throw 401 khi password sai', async () => {
      const hash = await bcrypt.hash('correctpassword', 10);
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        password: hash,
      } as any);

      await expect(
        login({ email: 'test@example.com', password: 'wrongpassword' })
      ).rejects.toMatchObject({ status: 401 });
    });

    it('should throw 401 khi email không tồn tại', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      await expect(
        login({ email: 'notexist@example.com', password: 'anypassword' })
      ).rejects.toMatchObject({ status: 401 });
    });
  });

  // ── REGISTER ───────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('should gửi email verification cho user mới', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const { sendMail } = require('../../../utils/mail');
      const { redisClient } = require('../../../config/redis');
      redisClient().set.mockResolvedValue('OK');
      redisClient().get.mockResolvedValue(null);

      const result = await register({
        name: 'New User',
        email: 'newuser@example.com',
        password: 'password123',
      });

      expect(result.email).toBe('newuser@example.com');
      expect(result.message).toBe('Verification email sent');
      expect(sendMail).toHaveBeenCalled();
    });

    it('should không tạo user nếu email đã tồn tại (timing guard)', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        id: 1,
        name: 'Existing User',
        email: 'existing@example.com',
        role: 'USER',
        password: 'hash',
      } as any);

      const result = await register({
        name: 'Duplicate',
        email: 'existing@example.com',
        password: 'password123',
      });

      // Vẫn trả về message thành công để tránh email enumeration
      expect(result.message).toBe('Verification email sent');
      expect(mockPrismaUser.create).not.toHaveBeenCalled();
    });
  });
});
