import 'dotenv/config';
import { connect, type Channel, type ChannelModel } from 'amqplib';
import { sendMail } from '../utils/mail';
import {
  buildVerifyEmailTemplate,
  buildOtpLoginTemplate,
} from '../utils/mail-templates';
import { buildOrderPlacedEmail } from '../modules/order/email-templates/order-placed-email';
import { buildOrderCompletedEmail } from '../modules/order/email-templates/order-completed-email';
import { buildOrderStatusEmail } from '../modules/order/email-templates/order-status-email';
import {
  EXCHANGE,
  EXCHANGE_DLQ,
  QUEUE_AUTH,
  QUEUE_ORDER,
  QUEUE_ORDER_DLQ,
  EmailEvent,
} from '../rabbitmq/events.enum';
import type {
  VerifyEmailPayload,
  OtpEmailPayload,
  OrderPlacedEmailPayload,
  OrderCompletedEmailPayload,
  OrderStatusEmailPayload,
} from '../rabbitmq/publisher';

const PREFETCH = 5;
const RECONNECT_DELAY_MS = 5_000;

async function setupChannel(conn: ChannelModel): Promise<Channel> {
  const ch = await conn.createChannel();
  ch.prefetch(PREFETCH);

  // Main notification exchange
  await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

  // Dead-letter exchange (direct)
  await ch.assertExchange(EXCHANGE_DLQ, 'direct', { durable: true });

  // Auth queue — no DLQ, just drop on failure
  await ch.assertQueue(QUEUE_AUTH, { durable: true });
  await ch.bindQueue(QUEUE_AUTH, EXCHANGE, 'email.auth.#');

  // Order queue — dead-letters to DLQ exchange
  await ch.assertQueue(QUEUE_ORDER, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': EXCHANGE_DLQ,
      'x-dead-letter-routing-key': 'email.order.dead',
    },
  });
  await ch.bindQueue(QUEUE_ORDER, EXCHANGE, 'email.order.#');

  // Dead-letter queue for failed order emails
  await ch.assertQueue(QUEUE_ORDER_DLQ, { durable: true });
  await ch.bindQueue(QUEUE_ORDER_DLQ, EXCHANGE_DLQ, 'email.order.dead');

  return ch;
}

async function handleMessage(
  ch: Channel,
  routingKey: string,
  payload: unknown,
  isOrderQueue: boolean,
  deliveryTag: number,
): Promise<void> {
  try {
    switch (routingKey) {
      case EmailEvent.AUTH_VERIFY: {
        const p = payload as VerifyEmailPayload;
        const { subject, html, text } = buildVerifyEmailTemplate({
          name: p.name,
          verifyLink: p.verifyLink,
          expiresInMinutes: p.expiresInMinutes,
          shopName: p.shopName,
        });
        await sendMail({ to: p.to, subject, html, text });
        break;
      }
      case EmailEvent.AUTH_OTP:
      case EmailEvent.AUTH_FORGOT: {
        const p = payload as OtpEmailPayload;
        const { subject, html, text } = buildOtpLoginTemplate({
          name: p.name,
          otp: p.otp,
          expiresInMinutes: p.expiresInMinutes,
          shopName: p.shopName,
        });
        await sendMail({ to: p.to, subject, html, text });
        break;
      }
      case EmailEvent.ORDER_PLACED: {
        const p = payload as OrderPlacedEmailPayload;
        const { subject, html, text } = buildOrderPlacedEmail({
          shopName: p.shopName,
          orderId: p.orderId,
          customerName: p.customerName,
          orderUrl: p.orderUrl,
          items: p.items,
          totalVnd: p.totalVnd,
        });
        await sendMail({ to: p.to, subject, html, text });
        break;
      }
      case EmailEvent.ORDER_COMPLETED: {
        const p = payload as OrderCompletedEmailPayload;
        const { subject, html, text } = buildOrderCompletedEmail({
          shopName: p.shopName,
          orderId: p.orderId,
          customerName: p.customerName,
          orderUrl: p.orderUrl,
          items: p.items,
          totalVnd: p.totalVnd,
          supportEmail: p.supportEmail,
          supportPhone: p.supportPhone,
        });
        await sendMail({ to: p.to, subject, html, text });
        break;
      }
      case EmailEvent.ORDER_STATUS_CHANGED: {
        const p = payload as OrderStatusEmailPayload;
        const { subject, html, text } = buildOrderStatusEmail({
          shopName: p.shopName,
          orderId: p.orderId,
          customerName: p.customerName,
          orderUrl: p.orderUrl,
          oldStatus: p.oldStatus,
          newStatus: p.newStatus,
        });
        await sendMail({ to: p.to, subject, html, text });
        break;
      }
      default:
        console.warn(`[EmailWorker] Unknown routing key: ${routingKey}`);
    }

    ch.ack({ fields: { deliveryTag } } as Parameters<Channel['ack']>[0]);
    console.log(`[EmailWorker] Sent ${routingKey}`);
  } catch (err) {
    console.error(`[EmailWorker] Failed to send ${routingKey}:`, err);
    // Order emails → NACK to DLQ; auth emails → drop
    ch.nack(
      { fields: { deliveryTag } } as Parameters<Channel['nack']>[0],
      false,
      false,
    );
  }
}

async function startConsuming(ch: Channel): Promise<void> {
  await ch.consume(QUEUE_AUTH, (msg) => {
    if (!msg) return;
    let payload: unknown;
    try { payload = JSON.parse(msg.content.toString('utf8')); } catch { payload = {}; }
    void handleMessage(ch, msg.fields.routingKey, payload, false, msg.fields.deliveryTag);
  });

  await ch.consume(QUEUE_ORDER, (msg) => {
    if (!msg) return;
    let payload: unknown;
    try { payload = JSON.parse(msg.content.toString('utf8')); } catch { payload = {}; }
    void handleMessage(ch, msg.fields.routingKey, payload, true, msg.fields.deliveryTag);
  });

  console.log('[EmailWorker] Consuming from', QUEUE_AUTH, 'and', QUEUE_ORDER);
}

async function run(): Promise<void> {
  let url = process.env.RABBITMQ_URL?.trim();
  if (!url) throw new Error('RABBITMQ_URL is not configured');

  while (true) {
    try {
      const conn: ChannelModel = await connect(url);

      conn.on('error', (err: Error) => console.error('[EmailWorker] Connection error:', err));
      conn.on('close', () => console.warn('[EmailWorker] Connection closed, reconnecting...'));

      const ch = await setupChannel(conn);
      ch.on('error', (err: Error) => console.error('[EmailWorker] Channel error:', err));

      await startConsuming(ch);

      // Keep the process alive until connection closes
      await new Promise<void>((resolve) => conn.on('close', resolve));
    } catch (err) {
      console.error('[EmailWorker] Startup error, retrying in', RECONNECT_DELAY_MS, 'ms:', err);
    }

    await new Promise<void>((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
  }
}

run().catch((err) => {
  console.error('[EmailWorker] Fatal error:', err);
  process.exit(1);
});
