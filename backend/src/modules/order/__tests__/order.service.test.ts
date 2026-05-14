jest.mock('../../../db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    product: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    order: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    orderItem: { findMany: jest.fn() },
    feedback: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../../utils/mail', () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../rabbitmq/publisher', () => ({
  publishOrderPlacedEmail: jest.fn().mockResolvedValue(undefined),
  publishOrderCompletedEmail: jest.fn().mockResolvedValue(undefined),
  publishOrderStatusEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../store-setting/store-setting.service', () => ({
  StoreSettingService: {
    getSetting: jest.fn().mockResolvedValue({ name: 'BanDai Shop', email: 'shop@test.com', phone: '0123' }),
  },
}));

import { prisma } from '../../../db';
import { createOrder, cancelUserOrder, updateOrderStatus } from '../order.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const fakeUser = { id: 1, name: 'Test User', email: 'test@example.com', role: 'USER' as const };
const fakeProduct = { id: 1, name: 'iPhone 15', price: 29990000, stock: 10, status: 'AVAILABLE' as const };
const fakeOrder = {
  id: 1,
  userId: 1,
  status: 'PENDING' as const,
  paymentStatus: 'PENDING' as const,
  total: 29990000,
  shippingAddress: '123 Test St',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [{
    productId: 1,
    quantity: 1,
    unitPrice: 29990000,
    product: { id: 1, name: 'iPhone 15', imageUrl: null },
  }],
  user: { id: 1, email: 'test@example.com', name: 'Test User' },
  paymentTransactions: [],
};

describe('OrderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.feedback.findMany as jest.Mock).mockResolvedValue([]);
  });

  describe('createOrder()', () => {
    it('should tạo order thành công', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(fakeUser) },
          product: {
            findUnique: jest.fn().mockResolvedValue(fakeProduct),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          order: { create: jest.fn().mockResolvedValue(fakeOrder) },
          feedback: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return fn(tx);
      });

      const result = await createOrder({
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
        shippingAddress: '123 Test St',
      });

      expect(result.id).toBe(1);
      expect(result.status).toBe('PENDING');
      expect(result.total).toBe(29990000);
    });

    it('should throw 400 khi userId không tồn tại', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(null) },
          product: { findUnique: jest.fn() },
          order: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(createOrder({
        userId: 999,
        items: [{ productId: 1, quantity: 1 }],
        shippingAddress: '123 Test St',
      })).rejects.toMatchObject({ status: 400 });
    });

    it('should throw 422 khi product không AVAILABLE', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(fakeUser) },
          product: {
            findUnique: jest.fn().mockResolvedValue({ ...fakeProduct, status: 'UNAVAILABLE' }),
          },
          order: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(createOrder({
        userId: 1,
        items: [{ productId: 1, quantity: 1 }],
        shippingAddress: '123 Test St',
      })).rejects.toMatchObject({ status: 422 });
    });

    it('should throw 422 khi không đủ stock', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          user: { findUnique: jest.fn().mockResolvedValue(fakeUser) },
          product: {
            findUnique: jest.fn().mockResolvedValue({ ...fakeProduct, stock: 1 }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }), // stock không đủ
          },
          order: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(createOrder({
        userId: 1,
        items: [{ productId: 1, quantity: 5 }],
        shippingAddress: '123 Test St',
      })).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('cancelUserOrder()', () => {
    it('should cancel order PENDING thành công', async () => {
      const cancelledOrder = { ...fakeOrder, status: 'CANCELLED' as const };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          order: {
            findFirst: jest.fn().mockResolvedValue(fakeOrder),
            update: jest.fn().mockResolvedValue(cancelledOrder),
          },
          orderItem: { findMany: jest.fn().mockResolvedValue([]) },
          product: { update: jest.fn().mockResolvedValue(fakeProduct) },
          feedback: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return fn(tx);
      });

      const result = await cancelUserOrder(1, 1);
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw 422 khi cancel order không phải PENDING', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          order: {
            findFirst: jest.fn().mockResolvedValue({ ...fakeOrder, status: 'DONE' }),
          },
        };
        return fn(tx);
      });

      await expect(cancelUserOrder(1, 1)).rejects.toMatchObject({ status: 422 });
    });

    it('should throw 404 khi order không tồn tại', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          order: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        return fn(tx);
      });

      await expect(cancelUserOrder(1, 999)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('updateOrderStatus()', () => {
    it('should transition PENDING → CONFIRMED', async () => {
      const confirmedOrder = { ...fakeOrder, status: 'CONFIRMED' as const };

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue(fakeOrder),
            update: jest.fn().mockResolvedValue(confirmedOrder),
          },
          orderItem: { findMany: jest.fn().mockResolvedValue([]) },
          product: { update: jest.fn() },
        };
        return fn(tx);
      });

      const result = await updateOrderStatus(1, 'CONFIRMED', 1, 'ADMIN');
      expect(result.status).toBe('CONFIRMED');
    });

    it('should throw 422 khi transition không hợp lệ (DONE → PENDING)', async () => {
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          order: {
            findUnique: jest.fn().mockResolvedValue({ ...fakeOrder, status: 'DONE' }),
          },
        };
        return fn(tx);
      });

      await expect(updateOrderStatus(1, 'PENDING' as any, 1, 'ADMIN'))
        .rejects.toMatchObject({ status: 422 });
    });
  });
});
