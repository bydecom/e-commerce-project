jest.mock('../../../config/redis', () => ({
  ensureRedisConnected: jest.fn().mockResolvedValue(undefined),
  redisClient: jest.fn().mockReturnValue({
    eval: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    zRem: jest.fn().mockResolvedValue(1),
    zRangeByScore: jest.fn(),
  }),
}));

jest.mock('../../order/order.service', () => ({
  cancelOrderSystem: jest.fn().mockResolvedValue(undefined),
}));

import { redisClient } from '../../../config/redis';
import * as orderService from '../../order/order.service';
import {
  reserveStockOrThrow,
  attachReservationOrderIdBestEffort,
  getReservationPayload,
  releaseReservationBestEffort,
  startReservationCleanupLoop,
} from '../stock-reservation.service';

const mockRedis = redisClient as jest.MockedFunction<typeof redisClient>;

describe('StockReservationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('reserveStockOrThrow()', () => {
    const defaultInput = {
      txnRef: 'txn-123',
      items: [{ productId: 1, quantity: 2 }],
      stockByProductId: new Map<number, number>([[1, 10]]),
      ttlSeconds: 300,
    };

    it('should reserve stock successfully when Redis LUA returns 1', async () => {
      const mockClient = mockRedis();
      (mockClient.eval as jest.Mock).mockResolvedValue(1);

      await expect(reserveStockOrThrow(defaultInput)).resolves.toBeUndefined();

      expect(mockClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          keys: expect.arrayContaining([
            'stock:hold:exp',
            'stock:hold:txn:txn-123',
            'stock:hold:qty:1',
          ]),
          arguments: [
            'txn-123',
            expect.any(String), // expiresAtMs
            expect.any(String), // JSON payload string
            '2', // requested quantity
            '10', // db stock snapshot
          ],
        })
      );
    });

    it('should throw HTTP 400 when txnRef is empty or malformed', async () => {
      await expect(
        reserveStockOrThrow({
          ...defaultInput,
          txnRef: '',
        })
      ).rejects.toMatchObject({ status: 400, message: 'Invalid transaction reference' });
    });

    it('should throw HTTP 400 when items array is empty', async () => {
      await expect(
        reserveStockOrThrow({
          ...defaultInput,
          items: [],
        })
      ).rejects.toMatchObject({ status: 400, message: 'items is required' });
    });

    it('should throw HTTP 400 when ttlSeconds is <= 0 or invalid', async () => {
      await expect(
        reserveStockOrThrow({
          ...defaultInput,
          ttlSeconds: 0,
        })
      ).rejects.toMatchObject({ status: 400, message: 'Invalid ttlSeconds' });
    });

    it('should throw HTTP 400 when stock snapshot is missing for a product', async () => {
      await expect(
        reserveStockOrThrow({
          ...defaultInput,
          stockByProductId: new Map(), // empty map
        })
      ).rejects.toMatchObject({ status: 400, message: 'Missing stock snapshot for product' });
    });

    it('should throw HTTP 422 immediately if requested quantity exceeds DB snapshot stock', async () => {
      await expect(
        reserveStockOrThrow({
          ...defaultInput,
          items: [{ productId: 1, quantity: 15 }], // exceeds 10 in snapshot
        })
      ).rejects.toMatchObject({
        status: 422,
        message: 'Insufficient stock',
        errors: expect.objectContaining({
          productId: 1,
          availableStock: 10,
          requestedQuantity: 15,
        }),
      });
    });

    it('should throw HTTP 422 OUT_OF_STOCK when Redis LUA returns standard failure', async () => {
      const mockClient = mockRedis();
      // returns [0, failingIndex, currentHoldQty, dbStockSnapshot, requestedQty]
      (mockClient.eval as jest.Mock).mockResolvedValue([0, 1, 9, 10, 2]);

      await expect(reserveStockOrThrow(defaultInput)).rejects.toMatchObject({
        status: 422,
        message: 'Insufficient stock',
        errors: expect.objectContaining({
          reason: 'OUT_OF_STOCK',
          items: [
            {
              productId: 1,
              requestedQuantity: 2,
              availableStock: 1, // 10 - 9 = 1 available
            },
          ],
        }),
      });
    });

    it('should throw HTTP 409 TEMPORARILY_HELD when available stock is 0 due to concurrent holds', async () => {
      const mockClient = mockRedis();
      // 10 reserved already out of 10 stock, and we want 2
      (mockClient.eval as jest.Mock).mockResolvedValue([0, 1, 10, 10, 2]);

      await expect(reserveStockOrThrow(defaultInput)).rejects.toMatchObject({
        status: 409,
        message: 'Insufficient stock',
        errors: expect.objectContaining({
          reason: 'TEMPORARILY_HELD',
          items: [
            {
              productId: 1,
              requestedQuantity: 2,
              availableStock: 0,
              holdTtlSeconds: expect.any(Number),
            },
          ],
        }),
      });
    });

    it('should handle unparseable Redis multi-bulk error payload correctly', async () => {
      const mockClient = mockRedis();
      // Redis returned null/unexpected shape
      (mockClient.eval as jest.Mock).mockResolvedValue(null);

      await expect(reserveStockOrThrow(defaultInput)).rejects.toMatchObject({
        status: 422,
        message: 'Insufficient stock',
        errors: expect.objectContaining({
          reason: 'OUT_OF_STOCK',
          items: [
            {
              productId: 1,
              requestedQuantity: 2,
              availableStock: 10,
            },
          ],
        }),
      });
    });
  });

  describe('attachReservationOrderIdBestEffort()', () => {
    it('should retrieve existing payload, update it with orderId, and set it back in Redis', async () => {
      const mockClient = mockRedis();
      const payload = {
        txnRef: 'txn-123',
        expiresAtMs: 1700000000000,
        items: [{ productId: 1, quantity: 2 }],
      };
      (mockClient.get as jest.Mock).mockResolvedValue(JSON.stringify(payload));
      (mockClient.set as jest.Mock).mockResolvedValue('OK');

      await attachReservationOrderIdBestEffort('txn-123', 99);

      expect(mockClient.get).toHaveBeenCalledWith('stock:hold:txn:txn-123');
      expect(mockClient.set).toHaveBeenCalledWith(
        'stock:hold:txn:txn-123',
        expect.stringContaining('"orderId":99')
      );
    });

    it('should ignore silently if txnRef or orderId is invalid', async () => {
      const mockClient = mockRedis();
      await attachReservationOrderIdBestEffort('', 99);
      await attachReservationOrderIdBestEffort('txn-123', -1);
      expect(mockClient.get).not.toHaveBeenCalled();
    });

    it('should swallow all Redis connection/retrieval errors silently (best effort)', async () => {
      const mockClient = mockRedis();
      (mockClient.get as jest.Mock).mockRejectedValue(new Error('Redis is completely down'));

      await expect(attachReservationOrderIdBestEffort('txn-123', 99)).resolves.toBeUndefined();
    });
  });

  describe('getReservationPayload()', () => {
    it('should parse and return the reservation payload', async () => {
      const mockClient = mockRedis();
      const payload = {
        txnRef: 'txn-123',
        expiresAtMs: 1700000000000,
        items: [{ productId: 1, quantity: 2 }],
        orderId: 99,
      };
      (mockClient.get as jest.Mock).mockResolvedValue(JSON.stringify(payload));

      const result = await getReservationPayload('txn-123');
      expect(result).toEqual(payload);
    });

    it('should return null when key does not exist or JSON is malformed', async () => {
      const mockClient = mockRedis();
      (mockClient.get as jest.Mock).mockResolvedValue(null);
      expect(await getReservationPayload('txn-123')).toBeNull();

      (mockClient.get as jest.Mock).mockResolvedValue('invalid-json');
      expect(await getReservationPayload('txn-123')).toBeNull();
    });
  });

  describe('releaseReservationBestEffort()', () => {
    it('should release reservation via RELEASE_LUA script when itemsHint is passed', async () => {
      const mockClient = mockRedis();
      (mockClient.eval as jest.Mock).mockResolvedValue(1);

      await releaseReservationBestEffort('txn-123', [{ productId: 1, quantity: 2 }]);

      expect(mockClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          keys: ['stock:hold:exp', 'stock:hold:txn:txn-123', 'stock:hold:qty:1'],
          arguments: ['txn-123'],
        })
      );
    });

    it('should fetch payload from Redis if itemsHint is not passed', async () => {
      const mockClient = mockRedis();
      const payload = {
        txnRef: 'txn-123',
        expiresAtMs: 1700000000000,
        items: [{ productId: 1, quantity: 2 }],
      };
      (mockClient.get as jest.Mock).mockResolvedValue(JSON.stringify(payload));
      (mockClient.eval as jest.Mock).mockResolvedValue(1);

      await releaseReservationBestEffort('txn-123');

      expect(mockClient.get).toHaveBeenCalledWith('stock:hold:txn:txn-123');
      expect(mockClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          keys: ['stock:hold:exp', 'stock:hold:txn:txn-123', 'stock:hold:qty:1'],
          arguments: ['txn-123'],
        })
      );
    });

    it('should clean up the hold key directly if no payload exists and no hint is supplied', async () => {
      const mockClient = mockRedis();
      (mockClient.get as jest.Mock).mockResolvedValue(null);

      await releaseReservationBestEffort('txn-123');

      expect(mockClient.del).toHaveBeenCalledWith('stock:hold:txn:txn-123');
      expect(mockClient.zRem).toHaveBeenCalledWith('stock:hold:exp', 'txn-123');
    });
  });

  describe('startReservationCleanupLoop()', () => {
    it('should run a cleanup tick periodically, acquiring the lock and processing expired entries', async () => {
      const mockClient = mockRedis();
      const mockCancel = orderService.cancelOrderSystem as jest.Mock;

      // Lock acquisition returns true
      (mockClient.set as jest.Mock).mockResolvedValue('OK');
      // zRangeByScore returns 2 expired txnRefs
      (mockClient.zRangeByScore as jest.Mock).mockResolvedValue(['txn-expired-1', 'txn-expired-2']);

      // Mock getReservationPayload for the two expired txns
      (mockClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'stock:hold:txn:txn-expired-1') {
          return Promise.resolve(
            JSON.stringify({
              txnRef: 'txn-expired-1',
              orderId: 101,
              items: [{ productId: 1, quantity: 1 }],
            })
          );
        }
        if (key === 'stock:hold:txn:txn-expired-2') {
          return Promise.resolve(
            JSON.stringify({
              txnRef: 'txn-expired-2',
              orderId: 102,
              items: [{ productId: 2, quantity: 2 }],
            })
          );
        }
        return Promise.resolve(null);
      });

      const loop = startReservationCleanupLoop({ intervalMs: 2000 });

      // Advance timers by 2 seconds to trigger one interval tick
      await jest.advanceTimersByTimeAsync(2000);

      // Verify distributed lock is acquired
      expect(mockClient.set).toHaveBeenCalledWith('stock:cleanup:lock', expect.any(String), {
        NX: true,
        EX: 1,
      });

      // Verify both orders were cancelled
      expect(mockCancel).toHaveBeenCalledTimes(2);
      expect(mockCancel).toHaveBeenNthCalledWith(1, 101);
      expect(mockCancel).toHaveBeenNthCalledWith(2, 102);

      // Verify cleanups were triggered
      expect(mockClient.eval).toHaveBeenCalledTimes(2);

      loop.stop();
    });

    it('should skip tick entirely if lock cannot be acquired', async () => {
      const mockClient = mockRedis();
      // Lock acquisition returns null (lock held by another PM2 instance)
      (mockClient.set as jest.Mock).mockResolvedValue(null);

      const loop = startReservationCleanupLoop({ intervalMs: 2000 });
      await jest.advanceTimersByTimeAsync(2000);

      expect(mockClient.zRangeByScore).not.toHaveBeenCalled();

      loop.stop();
    });
  });
});
