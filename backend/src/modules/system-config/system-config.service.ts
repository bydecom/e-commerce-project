import { prisma } from '../../db';
import { httpError } from '../../utils/http-error';
import { decryptValue, encryptValue } from '../../utils/crypto';

export type ConfigKey =
  | 'jwt_access_expires_in'
  | 'refresh_token_ttl_seconds'
  | 'verify_token_ttl_seconds'
  | 'pending_register_ttl_seconds'
  | 'product_cache_ttl_seconds'
  | 'checkout_reservation_ttl_seconds'
  | 'use_gemini'
  | 'gemini_api_key'
  | 'vnp_hash_secret'
  | 'vnp_return_url';

export type SystemConfigRecord = {
  key: ConfigKey;
  value: string;
  description: string | null;
  updatedAt: string;
};

export const MASKED_SECRET = '__MASKED_SECRET__';
const SENSITIVE_KEYS: ConfigKey[] = ['gemini_api_key', 'vnp_hash_secret'];

type ConfigMeta = {
  label: string;
  description: string;
  validate: (v: string) => string | null; // error message or null
};

export const CONFIG_META: Record<ConfigKey, ConfigMeta> = {
  jwt_access_expires_in: {
    label: 'Access Token Lifetime',
    description: 'How long the JWT access token stays valid (e.g. 14m, 1h, 30m).',
    validate: (v) => (/^\d+[smh]$/.test(v.trim()) ? null : 'Must be a duration like 14m, 1h, 30m'),
  },
  refresh_token_ttl_seconds: {
    label: 'Refresh Token Lifetime (seconds)',
    description: 'How long a refresh token stays valid before the user must log in again.',
    validate: (v) => validateIntRange(v, 60, 60 * 60 * 24 * 30, 'Must be at most 30 days (2592000 seconds)'),
  },
  verify_token_ttl_seconds: {
    label: 'Email Verification Link Lifetime (seconds)',
    description: 'How long the email verification link is valid.',
    validate: (v) => validateIntRange(v, 60, 86400, 'Must be at most 24 hours (86400 seconds)'),
  },
  pending_register_ttl_seconds: {
    label: 'Pending Registration Cleanup (seconds)',
    description: 'How long to keep an unverified registration before auto-deleting it.',
    validate: (v) => validateIntRange(v, 300, 86400, 'Must be at most 86400 seconds (24 hours)'),
  },
  product_cache_ttl_seconds: {
    label: 'Product Detail Cache TTL (seconds)',
    description: 'How long Redis caches product detail. Lower = fresher data, higher = better performance.',
    validate: (v) => validateIntRange(v, 1, 3600, 'Must be at most 3600 seconds (1 hour)'),
  },
  checkout_reservation_ttl_seconds: {
    label: 'Checkout Stock Reservation (seconds)',
    description: 'How long stock is held for a customer during payment before being released.',
    validate: (v) => validateIntRange(v, 60, 3600, 'Must be at most 3600 seconds (1 hour)'),
  },
  use_gemini: {
    label: 'Use Gemini AI',
    description: 'Whether to use Google Gemini as the AI provider. Requires a valid API key below.',
    validate: (v) => (v === 'true' || v === 'false' ? null : 'Must be "true" or "false"'),
  },
  gemini_api_key: {
    label: 'Gemini API Key',
    description: 'Your Google Gemini API key. Leave empty to use the local LLM.',
    validate: () => null,
  },
  vnp_hash_secret: {
    label: 'VNPay Hash Secret',
    description: 'VNPay HMAC secret used to sign/verify payments. Leave empty to use environment variable.',
    validate: () => null,
  },
  vnp_return_url: {
    label: 'VNPay Return URL',
    description: 'The URL VNPay redirects customers to after payment.',
    validate: (v) => {
      try {
        // eslint-disable-next-line no-new
        new URL(v.trim());
        return null;
      } catch {
        return 'Must be a valid URL (e.g. https://yourshop.com)';
      }
    },
  },
};

export const ALL_CONFIG_KEYS = Object.keys(CONFIG_META) as ConfigKey[];

// ─── In-memory cache (TTL 30s) ────────────────────────────────────────────────

type CacheEntry = { value: string; expiresAt: number };
const cache = new Map<ConfigKey, CacheEntry>();
const CACHE_TTL_MS = 30_000;

function cacheGet(key: ConfigKey): string | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(key: ConfigKey, value: string): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function clearSystemConfigCache(key?: ConfigKey): void {
  if (key) cache.delete(key);
  else cache.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getConfig(key: ConfigKey): Promise<string> {
  let value = cacheGet(key);
  if (value === undefined) {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    value = row?.value ?? getEnvFallback(key);

    // Cache chỉ lưu ciphertext / raw value, tuyệt đối không lưu plaintext đã giải mã
    cacheSet(key, value);
  }

  if (value && SENSITIVE_KEYS.includes(key)) {
    return decryptValue(value);
  }

  return value;
}

export async function getAllConfigs(): Promise<SystemConfigRecord[]> {
  const rows = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  const rowMap = new Map(rows.map((r) => [r.key, r]));

  return ALL_CONFIG_KEYS.map((key) => {
    const row = rowMap.get(key);
    let value = row?.value ?? getEnvFallback(key);

    if (SENSITIVE_KEYS.includes(key) && value) {
      value = MASKED_SECRET;
    }

    return {
      key,
      value,
      description: row?.description ?? CONFIG_META[key].description,
      updatedAt: row?.updatedAt.toISOString() ?? new Date(0).toISOString(),
    };
  });
}

export async function updateConfig(keyRaw: string, valueRaw: string): Promise<SystemConfigRecord> {
  if (!ALL_CONFIG_KEYS.includes(keyRaw as ConfigKey)) {
    throw httpError(400, `Unknown config key: ${keyRaw}`);
  }
  const key = keyRaw as ConfigKey;
  const meta = CONFIG_META[key];
  let value = valueRaw.trim();

  // Nếu là secret và FE gửi lại mask => không đổi
  if (SENSITIVE_KEYS.includes(key) && value === MASKED_SECRET) {
    const existingRow = await prisma.systemConfig.findUnique({ where: { key } });
    return {
      key,
      value: MASKED_SECRET,
      description: existingRow?.description ?? meta.description,
      updatedAt: existingRow?.updatedAt.toISOString() ?? new Date(0).toISOString(),
    };
  }

  const validationError = meta.validate(value);
  if (validationError) {
    throw httpError(400, `Invalid value for "${meta.label}": ${validationError}`);
  }

  if (SENSITIVE_KEYS.includes(key) && value !== '') {
    value = encryptValue(value);
  }

  const row = await prisma.systemConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value, description: meta.description },
  });

  clearSystemConfigCache(key);
  return {
    key,
    value: SENSITIVE_KEYS.includes(key) ? MASKED_SECRET : row.value,
    description: row.description,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function bulkUpdateConfigs(
  entries: Array<{ key: string; value: string }>
): Promise<SystemConfigRecord[]> {
  const errors: string[] = [];

  for (const { key, value } of entries) {
    if (!ALL_CONFIG_KEYS.includes(key as ConfigKey)) {
      errors.push(`Unknown key: ${key}`);
      continue;
    }
    const meta = CONFIG_META[key as ConfigKey];

    // Bỏ qua validate nếu value là MASKED_SECRET (người dùng không đổi secret)
    if (SENSITIVE_KEYS.includes(key as ConfigKey) && value === MASKED_SECRET) {
      continue;
    }

    const err = meta.validate(String(value ?? '').trim());
    if (err) errors.push(`"${meta.label}": ${err}`);
  }

  if (errors.length > 0) {
    throw httpError(400, errors.join('; '));
  }

  const out: SystemConfigRecord[] = [];
  for (const { key: keyRaw, value: valueRaw } of entries) {
    const key = keyRaw as ConfigKey;
    const meta = CONFIG_META[key];
    let valueToSave = valueRaw.trim();

    // FE gửi lại mask => giữ nguyên (không ghi DB)
    if (SENSITIVE_KEYS.includes(key) && valueToSave === MASKED_SECRET) {
      const existingRow = await prisma.systemConfig.findUnique({ where: { key } });
      out.push({
        key,
        value: MASKED_SECRET,
        description: existingRow?.description ?? meta.description,
        updatedAt: existingRow?.updatedAt.toISOString() ?? new Date(0).toISOString(),
      });
      continue;
    }

    if (SENSITIVE_KEYS.includes(key) && valueToSave !== '') {
      valueToSave = encryptValue(valueToSave);
    }

    const row = await prisma.systemConfig.upsert({
      where: { key },
      update: { value: valueToSave },
      create: { key, value: valueToSave, description: meta.description },
    });

    clearSystemConfigCache(key);
    out.push({
      key,
      value: SENSITIVE_KEYS.includes(key) ? MASKED_SECRET : row.value,
      description: row.description,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  return out;
}

export async function getConfigInt(key: ConfigKey, fallback: number): Promise<number> {
  const raw = await getConfig(key);
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function getConfigBool(key: ConfigKey, fallback: boolean): Promise<boolean> {
  const raw = await getConfig(key);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validateIntRange(v: string, min: number, max: number, maxMsg: string): string | null {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < min) return `Must be at least ${min}`;
  if (n > max) return maxMsg;
  return null;
}

function getEnvFallback(key: ConfigKey): string {
  const map: Record<ConfigKey, string> = {
    jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || '14m',
    refresh_token_ttl_seconds: process.env.REFRESH_TOKEN_TTL_SECONDS || '900',
    verify_token_ttl_seconds: process.env.VERIFY_TOKEN_TTL_SECONDS || '180',
    pending_register_ttl_seconds: process.env.PENDING_REGISTER_TTL_SECONDS || '1800',
    product_cache_ttl_seconds: process.env.PRODUCT_DETAIL_CACHE_TTL_SECONDS || '5',
    checkout_reservation_ttl_seconds: process.env.CHECKOUT_RESERVATION_TTL_SECONDS || '900',
    use_gemini: process.env.USE_GEMINI || 'false',
    gemini_api_key: process.env.GEMINI_API_KEY || '',
    vnp_hash_secret: process.env.VNP_HASH_SECRET || '',
    vnp_return_url: process.env.VNP_RETURN_URL || 'http://localhost:4200',
  };
  return map[key];
}

