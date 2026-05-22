export const EmailEvent = {
  AUTH_VERIFY:          'email.auth.verify',
  AUTH_OTP:             'email.auth.otp',
  AUTH_FORGOT:          'email.auth.forgot',
  ORDER_PLACED:         'email.order.placed',
  ORDER_COMPLETED:      'email.order.completed',
  ORDER_STATUS_CHANGED: 'email.order.status_changed',
} as const;

export type EmailEventValue = (typeof EmailEvent)[keyof typeof EmailEvent];

// ── AI async events ────────────────────────────────────────────
export const AiEvent = {
  PRODUCT_VECTOR_SYNC:  'ai.product.vector_sync',
  FEEDBACK_ANALYZE:     'ai.feedback.analyze',
} as const;

export type AiEventValue = (typeof AiEvent)[keyof typeof AiEvent];

// ── Exchanges ──────────────────────────────────────────────────
export const EXCHANGE     = 'ex.notification';
export const EXCHANGE_AI  = 'ex.ai';
export const EXCHANGE_DLQ = 'ex.dlq';

// ── Queues: Email ──────────────────────────────────────────────
export const QUEUE_AUTH      = 'q.notification.email.auth';
export const QUEUE_ORDER     = 'q.notification.email.order';
export const QUEUE_ORDER_DLQ = 'q.notification.email.order.dlq';

// ── Queues: AI ─────────────────────────────────────────────────
export const QUEUE_AI            = 'q.ai.tasks';
export const QUEUE_AI_DLQ        = 'q.ai.tasks.dlq';
