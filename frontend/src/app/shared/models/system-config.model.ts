export interface SystemConfigRecord {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
}

export type ConfigGroup = 'auth' | 'cache' | 'ai' | 'payment';

export interface SystemConfigMeta {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'duration' | 'url' | 'secret';
  group: ConfigGroup;
  min?: number;
  max?: number;
  unit?: 'seconds' | 'ms';
}

export const CONFIG_META_FE: SystemConfigMeta[] = [
  // Auth
  {
    key: 'jwt_access_expires_in',
    label: 'Access Token Lifetime',
    description: 'How long the JWT access token is valid (seconds). Shorter = more secure.',
    type: 'number',
    min: 60,
    max: 86_400,
    unit: 'seconds',
    group: 'auth',
  },
  {
    key: 'refresh_token_ttl_seconds',
    label: 'Refresh Token Lifetime',
    description: 'How long a refresh token is valid before users must log in again (seconds).',
    type: 'number',
    min: 60,
    max: 2_592_000,
    unit: 'seconds',
    group: 'auth',
  },
  {
    key: 'verify_token_ttl_seconds',
    label: 'Email Verification Link Lifetime',
    description: 'How long the email verification link stays valid (seconds).',
    type: 'number',
    min: 60,
    max: 86_400,
    unit: 'seconds',
    group: 'auth',
  },
  {
    key: 'pending_register_ttl_seconds',
    label: 'Pending Registration Cleanup',
    description: 'How long to keep an unverified registration before deleting it (seconds).',
    type: 'number',
    min: 300,
    max: 86_400,
    unit: 'seconds',
    group: 'auth',
  },
  {
    key: 'idle_timeout_seconds',
    label: 'Idle Logout Timeout',
    description: 'How long to logout automatically due to inactivity (seconds).',
    type: 'number',
    min: 60,
    max: 86_400,
    unit: 'seconds',
    group: 'auth',
  },

  // Cache
  {
    key: 'product_cache_ttl_seconds',
    label: 'Product Detail Cache TTL',
    description: 'How long Redis caches product detail pages (seconds). Lower = fresher stock info.',
    type: 'number',
    min: 1,
    max: 3_600,
    unit: 'seconds',
    group: 'cache',
  },
  {
    key: 'checkout_reservation_ttl_seconds',
    label: 'Checkout Stock Reservation',
    description: 'How long stock is held for a customer during payment before being released (seconds).',
    type: 'number',
    min: 60,
    max: 3_600,
    unit: 'seconds',
    group: 'cache',
  },

  // AI
  {
    key: 'use_gemini',
    label: 'Use Gemini AI',
    description: 'Enable Google Gemini as the AI provider. Requires an API key.',
    type: 'boolean',
    group: 'ai',
  },
  {
    key: 'gemini_api_key',
    label: 'Gemini API Key',
    description: 'Your Google Gemini API key. Leave empty to use the local LLM.',
    type: 'secret',
    group: 'ai',
  },

  // Payment
  {
    key: 'vnp_return_url',
    label: 'VNPay Return URL',
    description: 'The URL VNPay redirects customers to after payment.',
    type: 'url',
    group: 'payment',
  },
];

export const CONFIG_GROUPS: { id: ConfigGroup; label: string; icon: string }[] = [
  { id: 'auth', label: 'Authentication & Sessions', icon: '🔐' },
  { id: 'cache', label: 'Performance & Cache', icon: '⚡' },
  { id: 'ai', label: 'AI Configuration', icon: '🤖' },
  { id: 'payment', label: 'Payment Settings', icon: '💳' },
];

