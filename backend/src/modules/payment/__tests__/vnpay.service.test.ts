import crypto from 'crypto';

// ── Helpers dùng chung với vnpay.service.ts ──────────────────
// Copy lại đúng logic từ service để tạo hash hợp lệ trong test
const TEST_SECRET = 'test-secret-key-for-unit-test';

function encodeVnpComponent(s: string): string {
  return encodeURIComponent(s).replace(/%20/g, '+');
}

function sortObject(obj: Record<string, string>): Record<string, string> {
  const sorted: Record<string, string> = {};
  Object.keys(obj).sort().forEach((k) => { sorted[k] = obj[k]; });
  return sorted;
}

function buildHashData(sortedParams: Record<string, string>): string {
  return Object.keys(sortedParams)
    .map((k) => `${encodeVnpComponent(k)}=${encodeVnpComponent(sortedParams[k])}`)
    .join('&');
}

/** Tạo một bộ params VNPay hợp lệ có chữ ký đúng (method: decoded_no_encode) */
function makeValidParams(overrides: Record<string, string> = {}): Record<string, string> {
  const base: Record<string, string> = {
    vnp_Amount: '10000000', // 100,000 VND * 100
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: 'VNP123456',
    vnp_CardType: 'ATM',
    vnp_OrderInfo: 'Test+order',
    vnp_PayDate: '20240115120000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: 'TESTCODE',
    vnp_TransactionNo: '13800000',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: 'u1-1705300000000',
    ...overrides,
  };

  const sorted = sortObject(base);
  // method decoded_no_encode: key=value KHÔNG encode
  const signData = Object.keys(sorted).map((k) => `${k}=${sorted[k]}`).join('&');
  const hash = crypto.createHmac('sha512', TEST_SECRET).update(signData, 'utf8').digest('hex');

  return { ...base, vnp_SecureHash: hash, vnp_SecureHashType: 'SHA512' };
}

/** Tạo raw query string tương ứng với params */
function makeRawQueryString(params: Record<string, string>): string {
  return '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

// ── Mock env trước khi import service ────────────────────────
beforeAll(() => {
  process.env.VNP_HASH_SECRET = TEST_SECRET;
  process.env.VNP_TMN_CODE = 'TESTCODE';
  process.env.VNP_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  process.env.VNP_RETURN_URL = 'https://example.com/payment/return';
});

afterAll(() => {
  delete process.env.VNP_HASH_SECRET;
  delete process.env.VNP_TMN_CODE;
  delete process.env.VNP_URL;
  delete process.env.VNP_RETURN_URL;
});

// ── Mock dependencies của controller ─────────────────────────
jest.mock('../../../db', () => ({
  prisma: {
    order: { findUnique: jest.fn(), update: jest.fn() },
    orderItem: { findMany: jest.fn() },
    product: { update: jest.fn() },
    paymentTransaction: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../../cart/cart.service', () => ({
  clearCart: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../order/order.service', () => ({
  getAdminOrder: jest.fn().mockResolvedValue(null),
}));

jest.mock('../vnpay.store', () => ({
  getPendingVnpayCheckout: jest.fn().mockResolvedValue(null),
  consumePendingVnpayCheckout: jest.fn().mockResolvedValue(null),
  getCompletedOrderId: jest.fn().mockResolvedValue(null),
  putPendingVnpayCheckout: jest.fn().mockResolvedValue(undefined),
  markCompletedOrderId: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../inventory/stock-reservation.service', () => ({
  getReservationPayload: jest.fn().mockResolvedValue(null),
  reserveStockOrThrow: jest.fn().mockResolvedValue(undefined),
  releaseReservationBestEffort: jest.fn().mockResolvedValue(undefined),
  attachReservationOrderIdBestEffort: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../system-config/system-config.service', () => ({
  getConfig: jest.fn().mockResolvedValue(''),
  getConfigInt: jest.fn().mockResolvedValue(900),
}));

import { verifyVnpayReturn } from '../vnpay.service';
import { vnpayIpn } from '../vnpay.controller';
import { prisma } from '../../../db';
import * as vnpStore from '../vnpay.store';
import * as reservationService from '../../inventory/stock-reservation.service';
import * as cartService from '../../cart/cart.service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// ══════════════════════════════════════════════════════════════
// PHẦN 1: verifyVnpayReturn()
// ══════════════════════════════════════════════════════════════

describe('verifyVnpayReturn()', () => {

  // ── Happy paths ───────────────────────────────────────────

  describe('Chữ ký hợp lệ', () => {
    it('should xác thực thành công với method decoded_no_encode', () => {
      const params = makeValidParams();
      const result = verifyVnpayReturn(params);

      expect(result.isValidSignature).toBe(true);
      expect(result.signatureMethod).toBe('decoded_no_encode');
    });

    it('should xác thực thành công với raw_encoded querystring', () => {
      // Build params với encode kiểu raw
      const base: Record<string, string> = {
        vnp_Amount: '10000000',
        vnp_OrderInfo: 'Don+hang+test', // already encoded
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'TESTCODE',
        vnp_TransactionStatus: '00',
        vnp_TxnRef: 'u1-1705300000000',
      };
      const sorted = sortObject(base);
      const signData = Object.keys(sorted).map((k) => `${k}=${sorted[k]}`).join('&');
      const hash = crypto.createHmac('sha512', TEST_SECRET).update(signData, 'utf8').digest('hex');

      // rawQuery đã decode (như Express parse)
      const rawQuery = {
        ...base,
        vnp_OrderInfo: 'Don hang test', // Express đã decode '+' thành space
        vnp_SecureHash: hash,
        vnp_SecureHashType: 'SHA512',
      };
      // rawQueryString vẫn giữ '+' như VNPay gửi
      const rawQS = '?' + Object.entries({ ...base, vnp_SecureHash: hash })
        .map(([k, v]) => `${k}=${v}`).join('&');

      const result = verifyVnpayReturn(rawQuery, rawQS);
      expect(result.isValidSignature).toBe(true);
    });

    it('should ignore vnp_SecureHash và vnp_SecureHashType khi tính hash', () => {
      // Nếu 2 field này bị include vào hash data → hash sẽ sai → test fail
      const params = makeValidParams();
      const result = verifyVnpayReturn(params);

      expect(result.isValidSignature).toBe(true); // chứng minh chúng bị filter
    });

    it('should ignore các field không bắt đầu bằng vnp_', () => {
      const params = makeValidParams();
      const paramsWithExtra = {
        ...params,
        randomField: 'should-be-ignored',
        anotherField: '123',
      };

      const result = verifyVnpayReturn(paramsWithExtra);
      expect(result.isValidSignature).toBe(true);
    });
  });

  // ── isSuccess logic ───────────────────────────────────────

  describe('isSuccess calculation', () => {
    it('should isSuccess = true khi responseCode=00 và transactionStatus=00', () => {
      const params = makeValidParams({ vnp_ResponseCode: '00', vnp_TransactionStatus: '00' });
      const result = verifyVnpayReturn(params);

      expect(result.isSuccess).toBe(true);
      expect(result.responseCode).toBe('00');
      expect(result.transactionStatus).toBe('00');
    });

    it('should isSuccess = true khi responseCode=00 và KHÔNG có transactionStatus', () => {
      // Một số VNPay sandbox response không trả transactionStatus
      const base: Record<string, string> = {
        vnp_Amount: '10000000',
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'TESTCODE',
        vnp_TxnRef: 'u1-1705300000000',
      };
      const sorted = sortObject(base);
      const signData = Object.keys(sorted).map((k) => `${k}=${sorted[k]}`).join('&');
      const hash = crypto.createHmac('sha512', TEST_SECRET).update(signData, 'utf8').digest('hex');
      const params = { ...base, vnp_SecureHash: hash };

      const result = verifyVnpayReturn(params);
      expect(result.isSuccess).toBe(true);
      expect(result.transactionStatus).toBeUndefined();
    });

    it('should isSuccess = false khi responseCode != 00', () => {
      const params = makeValidParams({ vnp_ResponseCode: '24', vnp_TransactionStatus: '00' });
      const result = verifyVnpayReturn(params);

      expect(result.isSuccess).toBe(false);
      expect(result.responseCode).toBe('24');
    });

    it('should isSuccess = false khi transactionStatus != 00', () => {
      const params = makeValidParams({ vnp_ResponseCode: '00', vnp_TransactionStatus: '02' });
      const result = verifyVnpayReturn(params);

      expect(result.isSuccess).toBe(false);
    });

    it('should isSuccess = false khi chữ ký không hợp lệ dù responseCode=00', () => {
      const params = makeValidParams({ vnp_ResponseCode: '00', vnp_TransactionStatus: '00' });
      params.vnp_SecureHash = 'invalid-hash';

      const result = verifyVnpayReturn(params);
      expect(result.isSuccess).toBe(false);
      expect(result.isValidSignature).toBe(false);
    });
  });

  // ── Edge cases / Invalid inputs ───────────────────────────

  describe('Chữ ký không hợp lệ', () => {
    it('should trả isValidSignature = false khi hash sai', () => {
      const params = makeValidParams();
      params.vnp_SecureHash = 'deadbeef'.repeat(16); // 128 hex chars nhưng sai

      const result = verifyVnpayReturn(params);
      expect(result.isValidSignature).toBe(false);
      expect(result.signatureMethod).toBeUndefined();
    });

    it('should trả isValidSignature = false khi thiếu vnp_SecureHash', () => {
      const params = makeValidParams();
      delete (params as Record<string, string>).vnp_SecureHash;

      const result = verifyVnpayReturn(params);
      expect(result.isValidSignature).toBe(false);
    });

    it('should trả isValidSignature = false khi hash bị tamper (1 ký tự)', () => {
      const params = makeValidParams();
      const hash = params.vnp_SecureHash;
      // Đổi ký tự đầu
      params.vnp_SecureHash = (hash[0] === 'a' ? 'b' : 'a') + hash.slice(1);

      const result = verifyVnpayReturn(params);
      expect(result.isValidSignature).toBe(false);
    });

    it('should trả isValidSignature = false khi amount bị thay đổi sau khi ký', () => {
      const params = makeValidParams({ vnp_Amount: '10000000' });
      // Hacker đổi amount sau khi đã ký
      params.vnp_Amount = '1000'; // giảm xuống

      const result = verifyVnpayReturn(params);
      expect(result.isValidSignature).toBe(false);
    });
  });

  describe('Missing VNP_HASH_SECRET', () => {
    it('should throw Error khi VNP_HASH_SECRET không được set', () => {
      const original = process.env.VNP_HASH_SECRET;
      delete process.env.VNP_HASH_SECRET;

      expect(() => verifyVnpayReturn({})).toThrow('VNP_HASH_SECRET is not configured');

      process.env.VNP_HASH_SECRET = original;
    });
  });

  // ── Return structure ──────────────────────────────────────

  describe('Return structure', () => {
    it('should luôn trả về raw chứa tất cả vnp_ params', () => {
      const params = makeValidParams();
      const result = verifyVnpayReturn(params);

      expect(result.raw.vnp_TxnRef).toBe('u1-1705300000000');
      expect(result.raw.vnp_Amount).toBe('10000000');
      expect(result.raw.vnp_ResponseCode).toBe('00');
    });

    it('should parse vnp_Amount đúng (chia 100 trong context IPN)', () => {
      // verifyVnpayReturn trả raw amount (chưa chia), việc chia là của controller
      const params = makeValidParams({ vnp_Amount: '5000000' }); // 50,000 VND
      const result = verifyVnpayReturn(params);

      // raw.vnp_Amount là string gốc, chưa parse
      expect(result.raw.vnp_Amount).toBe('5000000');
      // Controller sẽ chia 100 → 50,000 VND
    });
  });
});

// ══════════════════════════════════════════════════════════════
// PHẦN 2: vnpayIpn()
// ══════════════════════════════════════════════════════════════

describe('vnpayIpn()', () => {

  // Helper tạo mock Request / Response
  function makeReq(queryOverrides: Record<string, string> = {}, urlOverride?: string) {
    const params = makeValidParams(queryOverrides);
    const qs = makeRawQueryString(params);
    return {
      query: params,
      originalUrl: urlOverride ?? `/api/payment/vnpay-ipn${qs}`,
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    } as any;
  }

  function makeRes() {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res as any;
  }

  const baseOrder = {
    id: 1,
    userId: 10,
    total: 100000, // 100,000 VND → vnp_Amount = 10000000 (×100)
    status: 'PENDING',
    paymentStatus: 'PENDING',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: tìm thấy order qua store
    (vnpStore.getPendingVnpayCheckout as jest.Mock).mockResolvedValue({
      userId: 10,
      orderId: 1,
      items: [{ productId: 1, quantity: 1 }],
    });
    (vnpStore.getCompletedOrderId as jest.Mock).mockResolvedValue(null);
    (reservationService.getReservationPayload as jest.Mock).mockResolvedValue({ orderId: 1 });
  });

  // ── Signature validation ──────────────────────────────────

  it('should trả RspCode=97 khi chữ ký không hợp lệ', async () => {
    const params = makeValidParams();
    params.vnp_SecureHash = 'invalid-signature';

    const req = { query: params, originalUrl: '/api/payment/vnpay-ipn?vnp_SecureHash=invalid', headers: {}, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
    const res = makeRes();

    await vnpayIpn(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ RspCode: '97', Message: 'Invalid signature' });
  });

  // ── Order not found ───────────────────────────────────────

  it('should trả RspCode=01 khi không tìm thấy orderId', async () => {
    (vnpStore.getPendingVnpayCheckout as jest.Mock).mockResolvedValue(null);
    (vnpStore.getCompletedOrderId as jest.Mock).mockResolvedValue(null);
    (reservationService.getReservationPayload as jest.Mock).mockResolvedValue(null);
    // prisma.paymentTransaction.findUnique cũng không có
    (mockPrisma.$transaction as jest.Mock).mockResolvedValue({ orderId: null });

    // Mock transaction để resolveOrderIdByTxnRef trả null
    const mockTx = {
      paymentTransaction: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    (mockPrisma.$transaction as jest.Mock).mockImplementation(async (fn: any) => fn(mockTx));

    const req = makeReq({ vnp_TxnRef: 'nonexistent-ref' });
    const res = makeRes();

    // Override store để không tìm thấy order
    (vnpStore.getPendingVnpayCheckout as jest.Mock).mockResolvedValue(null);
    (reservationService.getReservationPayload as jest.Mock).mockResolvedValue(null);

    await vnpayIpn(req, res);

    expect(res.json).toHaveBeenCalledWith({ RspCode: '01', Message: 'Order not found' });
  });

  // ── Amount mismatch ───────────────────────────────────────

  it('should trả RspCode=04 khi amount không khớp', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            ...baseOrder,
            total: 200000, // 200,000 VND → expect 20000000 nhưng VNPay gửi 10000000
          }),
        },
        paymentTransaction: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
        orderItem: { findMany: jest.fn().mockResolvedValue([]) },
        product: { update: jest.fn() },
      };
      return fn(tx);
    });

    const req = makeReq({ vnp_Amount: '10000000' }); // 100,000 VND
    const res = makeRes();

    await vnpayIpn(req, res);

    expect(res.json).toHaveBeenCalledWith({ RspCode: '04', Message: 'Invalid amount' });
  });

  // ── Already processed (duplicate IPN) ────────────────────

  it('should trả RspCode=02 khi IPN bị gửi lại (duplicate)', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: { findUnique: jest.fn().mockResolvedValue(baseOrder) },
        paymentTransaction: {
          // Đã có record → duplicate
          findUnique: jest.fn().mockResolvedValue({ id: 99 }),
          create: jest.fn(),
        },
        orderItem: { findMany: jest.fn().mockResolvedValue([]) },
        product: { update: jest.fn() },
      };
      return fn(tx);
    });

    const req = makeReq();
    const res = makeRes();

    await vnpayIpn(req, res);

    expect(res.json).toHaveBeenCalledWith({ RspCode: '02', Message: 'Order already processed' });
  });

  it('should trả RspCode=02 khi order.paymentStatus không phải PENDING', async () => {
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            ...baseOrder,
            paymentStatus: 'PAID', // đã paid rồi
          }),
        },
        paymentTransaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        orderItem: { findMany: jest.fn().mockResolvedValue([]) },
        product: { update: jest.fn() },
      };
      return fn(tx);
    });

    const req = makeReq();
    const res = makeRes();

    await vnpayIpn(req, res);

    expect(res.json).toHaveBeenCalledWith({ RspCode: '02', Message: 'Order already processed' });
  });

  // ── Payment success ───────────────────────────────────────

  it('should trả RspCode=00 và update order PAID khi thanh toán thành công', async () => {
    const mockOrderUpdate = jest.fn().mockResolvedValue({ ...baseOrder, paymentStatus: 'PAID' });

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: {
          findUnique: jest.fn().mockResolvedValue(baseOrder),
          update: mockOrderUpdate,
        },
        paymentTransaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        orderItem: { findMany: jest.fn().mockResolvedValue([]) },
        product: { update: jest.fn() },
      };
      return fn(tx);
    });

    const req = makeReq({
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_Amount: '10000000', // 100,000 × 100
    });
    const res = makeRes();

    await vnpayIpn(req, res);

    expect(res.json).toHaveBeenCalledWith({ RspCode: '00', Message: 'Confirm Success' });
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { paymentStatus: 'PAID' } })
    );
    expect(cartService.clearCart).toHaveBeenCalledWith(baseOrder.userId);
    expect(vnpStore.markCompletedOrderId).toHaveBeenCalled();
    expect(reservationService.releaseReservationBestEffort).toHaveBeenCalled();
  });

  // ── Payment failed ────────────────────────────────────────

  it('should trả RspCode=00 và cancel order + restore stock khi thanh toán thất bại', async () => {
    const mockOrderUpdate = jest.fn().mockResolvedValue({
      ...baseOrder,
      status: 'CANCELLED',
      paymentStatus: 'FAILED',
    });
    const mockProductUpdate = jest.fn().mockResolvedValue({});

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        order: {
          findUnique: jest.fn().mockResolvedValue(baseOrder),
          update: mockOrderUpdate,
        },
        paymentTransaction: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
        orderItem: {
          findMany: jest.fn().mockResolvedValue([
            { productId: 1, quantity: 2 },
            { productId: 2, quantity: 1 },
          ]),
        },
        product: { update: mockProductUpdate },
      };
      return fn(tx);
    });

    // ResponseCode != 00 → payment fail
    const params = makeValidParams({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' });
    // Phải rebuild hash vì đã thay đổi params
    const filtered = Object.fromEntries(
      Object.entries(params).filter(([k]) => k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType')
    ) as Record<string, string>;
    const sorted = sortObject(filtered);
    const signData = Object.keys(sorted).map((k) => `${k}=${sorted[k]}`).join('&');
    params.vnp_SecureHash = crypto.createHmac('sha512', TEST_SECRET).update(signData, 'utf8').digest('hex');

    const qs = makeRawQueryString(params);
    const req = { query: params, originalUrl: `/api/payment/vnpay-ipn${qs}`, headers: {}, ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
    const res = makeRes();

    await vnpayIpn(req, res);

    expect(res.json).toHaveBeenCalledWith({ RspCode: '00', Message: 'Confirm Success' });
    // Stock phải được restore cho 2 items
    expect(mockProductUpdate).toHaveBeenCalledTimes(2);
    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stock: { increment: 2 } } })
    );
    // Order phải CANCELLED
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
      })
    );
    // clearCart KHÔNG được gọi khi payment fail
    expect(cartService.clearCart).not.toHaveBeenCalled();
  });

  // ── Race condition / Prisma P2002 ─────────────────────────

  it('should trả RspCode=02 khi Prisma throw P2002 (unique constraint — race condition)', async () => {
    const { Prisma } = await import('@prisma/client');
    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });

    mockPrisma.$transaction.mockRejectedValue(p2002Error);

    const req = makeReq();
    const res = makeRes();

    await vnpayIpn(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ RspCode: '02', Message: 'Order already processed' });
  });

  // ── Unknown error ─────────────────────────────────────────

  it('should trả RspCode=99 khi có lỗi không xác định', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('DB connection lost'));

    const req = makeReq();
    const res = makeRes();

    await vnpayIpn(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ RspCode: '99', Message: 'Unknown error' });
  });
});
