export const EmailEvent = {
  AUTH_VERIFY:          'email.auth.verify',
  AUTH_OTP:             'email.auth.otp',
  AUTH_FORGOT:          'email.auth.forgot',
  ORDER_PLACED:         'email.order.placed',
  ORDER_COMPLETED:      'email.order.completed',
  ORDER_STATUS_CHANGED: 'email.order.status_changed',
} as const;

export type EmailEventValue = (typeof EmailEvent)[keyof typeof EmailEvent];

export const EXCHANGE = 'ex.notification';
export const QUEUE_AUTH  = 'q.notification.email.auth';
export const QUEUE_ORDER = 'q.notification.email.order';
export const QUEUE_ORDER_DLQ = 'q.notification.email.order.dlq';
export const EXCHANGE_DLQ = 'ex.dlq';
