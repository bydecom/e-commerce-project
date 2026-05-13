jest.mock('../../../db', () => ({
  prisma: {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    category: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  },
}));

jest.mock('../../../config/redis', () => ({
  ensureRedisConnected: jest.fn().mockResolvedValue(undefined),
  redisClient: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

jest.mock('../../ai/ai.service', () => ({
  searchVectors: jest.fn().mockResolvedValue([]),
  initQdrant: jest.fn().mockResolvedValue(undefined),
  upsertProductVector: jest.fn().mockResolvedValue(undefined),
  deleteProductVector: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../system-config/system-config.service', () => ({
  getConfigInt: jest.fn().mockResolvedValue(5),
}));

import { prisma } from '../../../db';
import {
  getProductById,
  createProduct,
  listProducts,
} from '../product.service';

const mockProduct = prisma.product as jest.Mocked<typeof prisma.product>;
const mockCategory = prisma.category as jest.Mocked<typeof prisma.category>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

const fakeProduct = {
  id: 1,
  name: 'iPhone 15 Pro',
  title_unaccent: 'iphone 15 pro',
  description: 'Test description',
  price: 29990000,
  stock: 10,
  imageUrl: null,
  status: 'AVAILABLE' as const,
  categoryId: 1,
  category: { id: 1, name: 'Smartphone' },
};

describe('ProductService', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── GET BY ID ──────────────────────────────────────────────────────────────

  describe('getProductById()', () => {
    it('should trả về product khi tìm thấy', async () => {
      mockProduct.findUnique.mockResolvedValue(fakeProduct as any);

      const result = await getProductById(1);

      expect(result.id).toBe(1);
      expect(result.name).toBe('iPhone 15 Pro');
      expect(result.price).toBe(29990000);
    });

    it('should throw 404 khi không tìm thấy product', async () => {
      mockProduct.findUnique.mockResolvedValue(null);

      await expect(getProductById(999)).rejects.toMatchObject({ status: 404 });
    });
  });

  // ── CREATE ─────────────────────────────────────────────────────────────────

  describe('createProduct()', () => {
    it('should tạo product thành công', async () => {
      mockCategory.findUnique.mockResolvedValue({ id: 1, name: 'Smartphone' } as any);
      mockProduct.create.mockResolvedValue(fakeProduct as any);

      const result = await createProduct({
        name: 'iPhone 15 Pro',
        price: 29990000,
        stock: 10,
        categoryId: 1,
        status: 'AVAILABLE',
      });

      expect(result.name).toBe('iPhone 15 Pro');
      expect(mockProduct.create).toHaveBeenCalledTimes(1);
    });

    it('should throw 400 khi categoryId không tồn tại', async () => {
      mockCategory.findUnique.mockResolvedValue(null);

      await expect(
        createProduct({
          name: 'Test',
          price: 1000,
          stock: 1,
          categoryId: 999,
        })
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  // ── LIST ───────────────────────────────────────────────────────────────────

  describe('listProducts()', () => {
    it('should trả về danh sách products với pagination', async () => {
      mockPrisma.$transaction.mockResolvedValue([1, [fakeProduct]] as any);

      const result = await listProducts({ page: '1', limit: '10' });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should trả về empty khi không có product', async () => {
      mockPrisma.$transaction.mockResolvedValue([0, []] as any);

      const result = await listProducts({});

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });
});
