import crypto from 'crypto';

type VnpParams = Record<string, string>;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// VNPay expects format yyyyMMddHHmmss in GMT+7 (Asia/Ho_Chi_Minh).
function formatVnpDateGmt7(date: Date): string {
  const ms = date.getTime() + 7 * 60 * 60 * 1000;
  const d = new Date(ms);
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds())
  );
}

function sortObject(obj: VnpParams): VnpParams {
  const sorted: VnpParams = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      sorted[k] = obj[k];
    });
  return sorted;
}

function encodeVnpComponent(s: string): string {
  // VNPay integrations commonly require spaces to be encoded as '+'
  // (application/x-www-form-urlencoded style), not '%20'.
  return encodeURIComponent(s).replace(/%20/g, '+');
}

function buildHashData(sortedParams: VnpParams): string {
  // Per VNPay guideline (PHP sample): ksort + hashData = urlencode(key)=urlencode(value) joined by '&'
  return Object.keys(sortedParams)
    .map((k) => `${encodeVnpComponent(k)}=${encodeVnpComponent(sortedParams[k])}`)
    .join('&');
}

function buildQueryString(sortedParams: VnpParams): string {
  // URL query: also urlencode key/value (same as hash data)
  return buildHashData(sortedParams);
}

function toSignData(params: VnpParams): string {
  return buildHashData(params);
}

export type CreateVnpayPaymentInput = {
  amountVnd: number;
  ipAddr: string;
  orderInfo: string;
  locale?: 'vn' | 'en';
  returnUrl?: string;
  txnRef?: string;
};

export type CreateVnpayPaymentResult = {
  paymentUrl: string;
  vnp_Params: VnpParams;
};

export function createVnpayPaymentUrl(input: CreateVnpayPaymentInput): CreateVnpayPaymentResult {
  const vnp_TmnCode = process.env.VNP_TMN_CODE?.trim();
  const vnp_HashSecret = process.env.VNP_HASH_SECRET?.trim();
  const vnp_Url = process.env.VNP_URL?.trim();
  const defaultReturnUrl = process.env.VNP_RETURN_URL?.trim();

  if (!vnp_TmnCode) throw new Error('VNP_TMN_CODE is not configured');
  if (!vnp_HashSecret) throw new Error('VNP_HASH_SECRET is not configured');
  if (!vnp_Url) throw new Error('VNP_URL is not configured');
  const returnUrl = input.returnUrl ?? defaultReturnUrl;
  if (!returnUrl) throw new Error('VNP_RETURN_URL is not configured');

  const amount = Math.round(input.amountVnd);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Invalid amount');

  const vnp_Version = '2.1.0';
  const vnp_Command = 'pay';
  const vnp_Locale = input.locale ?? 'vn';
  const vnp_CurrCode = 'VND';
  const vnp_TxnRef = input.txnRef ?? String(Date.now());
  const vnp_OrderInfo = input.orderInfo;
  const vnp_OrderType = 'other';
  const vnp_Amount = String(amount * 100); // VNPay expects *100
  const vnp_ReturnUrl = returnUrl;
  const vnp_IpAddr = input.ipAddr;
  const vnp_CreateDate = formatVnpDateGmt7(new Date());

  const params: VnpParams = sortObject({
    vnp_Version,
    vnp_Command,
    vnp_TmnCode,
    vnp_Locale,
    vnp_CurrCode,
    vnp_TxnRef,
    vnp_OrderInfo,
    vnp_OrderType,
    vnp_Amount,
    vnp_ReturnUrl,
    vnp_IpAddr,
    vnp_CreateDate,
  });

  const signData = toSignData(params);
  const secureHash = crypto.createHmac('sha512', vnp_HashSecret).update(signData, 'utf8').digest('hex');

  const signedParams = { ...params, vnp_SecureHashType: 'SHA512', vnp_SecureHash: secureHash };
  const paymentUrl = `${vnp_Url}?${buildQueryString(signedParams)}`;
  return { paymentUrl, vnp_Params: signedParams };
}

export type VerifyVnpayReturnResult = {
  isValidSignature: boolean;
  signatureMethod?: 'decoded_no_encode' | 'raw_encoded';
  responseCode?: string;
  transactionStatus?: string;
  isSuccess: boolean;
  raw: Record<string, string>;
  debug?: {
    signDataDecodedNoEncode: string;
    expectedDecodedNoEncode: string;
    signDataDecoded: string;
    expectedDecoded: string;
    signDataRawEncoded?: string;
    expectedRawEncoded?: string;
  };
};

function parseRawQueryEncoded(rawQueryString: string): Record<string, string> {
  const out: Record<string, string> = {};
  const qs = rawQueryString.startsWith('?') ? rawQueryString.slice(1) : rawQueryString;
  if (!qs) return out;
  for (const part of qs.split('&')) {
    if (!part) continue;
    const idx = part.indexOf('=');
    const k = idx >= 0 ? part.slice(0, idx) : part;
    const v = idx >= 0 ? part.slice(idx + 1) : '';
    // Keep as-is (still percent-encoded / '+'), because VNPay signature is based on this representation.
    out[k] = v;
  }
  return out;
}

export function verifyVnpayReturn(
  rawQuery: Record<string, unknown>,
  rawQueryString?: string
): VerifyVnpayReturnResult {
  const vnp_HashSecret = process.env.VNP_HASH_SECRET?.trim();
  if (!vnp_HashSecret) throw new Error('VNP_HASH_SECRET is not configured');

  const raw: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawQuery)) {
    if (v === undefined || v === null) continue;
    raw[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }

  const providedHash = raw.vnp_SecureHash;
  const providedHashType = raw.vnp_SecureHashType;

  // VNPay official demos verify using a decoded object and stringify with encode=false.
  const filteredDecoded: VnpParams = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'vnp_SecureHash' || k === 'vnp_SecureHashType') continue;
    if (!k.startsWith('vnp_')) continue;
    filteredDecoded[k] = v;
  }
  const sortedDecoded = sortObject(filteredDecoded);
  const signDataDecodedNoEncode = Object.keys(sortedDecoded)
    .map((k) => `${k}=${sortedDecoded[k]}`)
    .join('&');
  const expectedDecodedNoEncode = crypto
    .createHmac('sha512', vnp_HashSecret)
    .update(signDataDecodedNoEncode, 'utf8')
    .digest('hex');
  const signDataDecoded = buildHashData(sortedDecoded);
  const expectedDecoded = crypto.createHmac('sha512', vnp_HashSecret).update(signDataDecoded, 'utf8').digest('hex');

  // Fallback: some deployments require verifying over the raw encoded querystring.
  const encoded = rawQueryString ? parseRawQueryEncoded(rawQueryString) : null;
  let expectedRawEncoded: string | null = null;
  let signDataRawEncoded: string | null = null;
  if (encoded) {
    const filteredEncoded: VnpParams = {};
    for (const [k, v] of Object.entries(encoded)) {
      if (k === 'vnp_SecureHash' || k === 'vnp_SecureHashType') continue;
      if (!k.startsWith('vnp_')) continue;
      // Values are still encoded here (e.g. %xx or '+'). HashData in guideline uses urlencode() output,
      // so we can use these raw encoded pairs directly without re-encoding.
      filteredEncoded[k] = v;
    }
    const sortedEncoded = sortObject(filteredEncoded);
    signDataRawEncoded = Object.keys(sortedEncoded)
      .map((k) => `${k}=${sortedEncoded[k]}`)
      .join('&');
    expectedRawEncoded = crypto.createHmac('sha512', vnp_HashSecret).update(signDataRawEncoded, 'utf8').digest('hex');
  }

  const provided = String(providedHash ?? '').toLowerCase();
  const isValidDecodedNoEncode = Boolean(providedHash) && expectedDecodedNoEncode.toLowerCase() === provided;
  const isValidDecoded = Boolean(providedHash) && expectedDecoded.toLowerCase() === provided;
  const isValidRawEncoded = Boolean(providedHash) && expectedRawEncoded?.toLowerCase() === provided;
  const isValidSignature = isValidDecodedNoEncode || isValidDecoded || Boolean(isValidRawEncoded);
  const signatureMethod = isValidDecodedNoEncode
    ? 'decoded_no_encode'
    : isValidDecoded
      ? 'decoded_no_encode'
      : isValidRawEncoded
        ? 'raw_encoded'
        : undefined;

  const responseCode = raw.vnp_ResponseCode;
  const transactionStatus = raw.vnp_TransactionStatus;
  const isSuccess = isValidSignature && responseCode === '00' && (transactionStatus === undefined || transactionStatus === '00');

  return {
    isValidSignature,
    signatureMethod,
    responseCode,
    transactionStatus,
    isSuccess,
    raw: {
      ...raw,
      ...(providedHashType ? { vnp_SecureHashType: providedHashType } : {}),
    },
    ...(process.env.DEBUG_VNPAY === '1'
      ? {
          debug: {
            signDataDecodedNoEncode,
            expectedDecodedNoEncode,
            signDataDecoded,
            expectedDecoded,
            ...(signDataRawEncoded && expectedRawEncoded
              ? { signDataRawEncoded, expectedRawEncoded }
              : {}),
          },
        }
      : {}),
  };
}

