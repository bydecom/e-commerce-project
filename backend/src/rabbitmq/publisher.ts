import { publishEvent } from '../config/rabbitmq';
import { EmailEvent, EXCHANGE } from './events.enum';

export type VerifyEmailPayload = {
  to: string;
  name: string | null;
  verifyLink: string;
  expiresInMinutes: number;
  shopName: string;
};

export type OtpEmailPayload = {
  to: string;
  name: string | null;
  otp: string;
  expiresInMinutes: number;
  shopName: string;
};

export type OrderPlacedEmailPayload = {
  to: string;
  customerName: string;
  orderId: number;
  orderUrl: string;
  items: Array<{ name: string; quantity: number }>;
  totalVnd: string;
  shopName: string;
};

export type OrderCompletedEmailPayload = {
  to: string;
  customerName: string;
  orderId: number;
  orderUrl: string;
  items: Array<{ name: string; quantity: number }>;
  totalVnd: string;
  shopName: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
};

export type OrderStatusEmailPayload = {
  to: string;
  customerName: string;
  orderId: number;
  orderUrl: string;
  oldStatus: string;
  newStatus: string;
  shopName: string;
};

export async function publishVerifyEmail(payload: VerifyEmailPayload): Promise<void> {
  await publishEvent({ exchange: EXCHANGE, routingKey: EmailEvent.AUTH_VERIFY, payload });
}

export async function publishOtpEmail(payload: OtpEmailPayload): Promise<void> {
  await publishEvent({ exchange: EXCHANGE, routingKey: EmailEvent.AUTH_OTP, payload });
}

export async function publishForgotEmail(payload: OtpEmailPayload): Promise<void> {
  await publishEvent({ exchange: EXCHANGE, routingKey: EmailEvent.AUTH_FORGOT, payload });
}

export async function publishOrderPlacedEmail(payload: OrderPlacedEmailPayload): Promise<void> {
  await publishEvent({ exchange: EXCHANGE, routingKey: EmailEvent.ORDER_PLACED, payload });
}

export async function publishOrderCompletedEmail(payload: OrderCompletedEmailPayload): Promise<void> {
  await publishEvent({ exchange: EXCHANGE, routingKey: EmailEvent.ORDER_COMPLETED, payload });
}

export async function publishOrderStatusEmail(payload: OrderStatusEmailPayload): Promise<void> {
  await publishEvent({ exchange: EXCHANGE, routingKey: EmailEvent.ORDER_STATUS_CHANGED, payload });
}
