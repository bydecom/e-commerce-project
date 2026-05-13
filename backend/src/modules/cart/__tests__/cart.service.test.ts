jest.mock('../../../db', () => ({
  prisma: {
    product: { findUnique: jest.fn(), findMany: jest.fn() },
    order: { findMany: jest.fn() },
  },
}));

jest.mock('../../../config/redis', () => ({
  ensureRedisConnected: jest.fn().mockResolvedValue(undefined),
  redisClient: jest.fn().mockReturnValue({
    hGet: jest.fn(),
    hGetAll: jest.fn(),
    hSet: jest.fn(),
    hDel: jest.fn(),
    del: jest.fn(),
    watch: jest.fn().mockResolvedValue('OK'),
    multi: jest.fn().mockReturnValue({
      hSet: jest.fn().mockReturnThis(),
      hDel: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(['OK']),
    }),
  }),
}));

jest.mock('../../order/order.service', () => ({
  cancelOrderSystem: jest.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../../../db';
import { redisClient } from '../../../config/redis';
import { getCart, removeItem, clearCart, getCartWithPricing } from '../cart.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockRedis = redisClient as jest.MockedFunction<typeof redisClient>;

describe('CartService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getCart()', () => {
    it('should trả về danh sách items trong giỏ hàng', async () => {
      mockRedis().hGetAll.mockResolvedValue({
        '1': JSON.stringify({ quantity: 2, name: 'iPhone 15' }),
        '2': JSON.stringify({ quantity: 1, name: 'MacBook Pro' }),
      });

      const result = await getCart(1);

      expect(result).toHaveLength(2);
      expect(result[0].productId).toBe(1);
      expect(result[0].quantity).toBe(2);
    });

    it('should trả về empty array khi giỏ hàng trống', async () => {
      mockRedis().hGetAll.mockResolvedValue({});

      const result = await getCart(1);
      expect(result).toHaveLength(0);
    });

    it('should throw 400 khi userId không hợp lệ', async () => {
      await expect(getCart(-1)).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('removeItem()', () => {
    it('should xóa item khỏi giỏ hàng thành công', async () => {
      mockRedis().hDel.mockResolvedValue(1);
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await removeItem({ userId: 1, productId: 1 });
      expect(result.removed).toBe(true);
    });

    it('should trả về removed: false khi item không tồn tại', async () => {
      mockRedis().hDel.mockResolvedValue(0);

      const result = await removeItem({ userId: 1, productId: 999 });
      expect(result.removed).toBe(false);
    });
  });

  describe('clearCart()', () => {
    it('should xóa toàn bộ giỏ hàng', async () => {
      mockRedis().del.mockResolvedValue(1);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await expect(clearCart(1)).resolves.toBeUndefined();
      expect(mockRedis().del).toHaveBeenCalledWith('cart:user:1');
    });
  });

  describe('getCartWithPricing()', () => {
    it('should tính toán giá đúng cho từng item', async () => {
      mockRedis().hGetAll.mockResolvedValue({
        '1': JSON.stringify({ quantity: 2, name: 'iPhone 15' }),
      });
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 1, price: 29990000 } as any,
      ]);

      const result = await getCartWithPricing(1);

      expect(result.items[0].unitPrice).toBe(29990000);
      expect(result.items[0].lineTotal).toBe(59980000);
      expect(result.total).toBe(59980000);
    });

    it('should trả về empty khi giỏ hàng trống', async () => {
      mockRedis().hGetAll.mockResolvedValue({});

      const result = await getCartWithPricing(1);
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
