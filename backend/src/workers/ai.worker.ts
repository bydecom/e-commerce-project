import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Tự động load .env.production trên EC2, còn chạy local thì load .env bình thường
if (process.env.NODE_ENV === 'production' && fs.existsSync('.env.production')) {
  dotenv.config({ path: '.env.production' });
} else {
  dotenv.config(); // fallback local
}
import { connect, type Channel, type ChannelModel } from 'amqplib';
import { prisma } from '../db';
import { initQdrant, upsertProductVector } from '../modules/ai/ai.service';
import { analyzeFeedback } from '../modules/ai/feedback/feedback-analyzer';
import {
  AiEvent,
  EXCHANGE_AI,
  EXCHANGE_DLQ,
  QUEUE_AI,
  QUEUE_AI_DLQ,
} from '../rabbitmq/events.enum';
import type {
  ProductVectorSyncPayload,
  FeedbackAnalyzePayload,
} from '../rabbitmq/publisher';

const PREFETCH = 1; // AI tasks nặng, không nên xử lý nhiều song song
const RECONNECT_DELAY_MS = 5_000;

async function setupChannel(conn: ChannelModel): Promise<Channel> {
  const ch = await conn.createChannel();
  ch.prefetch(PREFETCH);

  // AI exchange
  await ch.assertExchange(EXCHANGE_AI, 'topic', { durable: true });

  // DLQ exchange (dùng chung với email worker)
  await ch.assertExchange(EXCHANGE_DLQ, 'direct', { durable: true });

  // AI queue — dead-letters sang DLQ khi fail
  await ch.assertQueue(QUEUE_AI, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': EXCHANGE_DLQ,
      'x-dead-letter-routing-key': 'ai.task.dead',
    },
  });
  await ch.bindQueue(QUEUE_AI, EXCHANGE_AI, 'ai.#');

  // DLQ để giữ lại các task AI fail để debug
  await ch.assertQueue(QUEUE_AI_DLQ, { durable: true });
  await ch.bindQueue(QUEUE_AI_DLQ, EXCHANGE_DLQ, 'ai.task.dead');

  return ch;
}

// ── Handler: Qdrant Vector Sync ────────────────────────────────

async function handleProductVectorSync(payload: ProductVectorSyncPayload): Promise<void> {
  console.log(`[AiWorker] Syncing vector for product #${payload.productId}: ${payload.name}`);

  await initQdrant();
  await upsertProductVector({
    id: payload.productId,
    name: payload.name,
    description: payload.description ?? '',
    categoryName: payload.categoryName ?? '',
    price: payload.price,
  });

  console.log(`[AiWorker] Vector synced for product #${payload.productId}`);
}

// ── Handler: Feedback AI Analysis ─────────────────────────────

async function handleFeedbackAnalyze(payload: FeedbackAnalyzePayload): Promise<void> {
  console.log(`[AiWorker] Analyzing feedback #${payload.feedbackId}`);

  // Kiểm tra feedback vẫn còn tồn tại và chưa được analyze
  const feedback = await prisma.feedback.findUnique({
    where: { id: payload.feedbackId },
    select: { id: true, sentiment: true, typeId: true },
  });

  if (!feedback) {
    console.warn(`[AiWorker] Feedback #${payload.feedbackId} not found — skipping`);
    return;
  }

  // Nếu đã được analyze rồi (không còn PENDING) thì skip — idempotent
  if (feedback.sentiment !== 'PENDING') {
    console.warn(`[AiWorker] Feedback #${payload.feedbackId} already analyzed — skipping`);
    return;
  }

  const analysis = await analyzeFeedback(payload.comment);

  // Resolve typeId nếu AI suggest
  let finalTypeId = analysis.resolvedTypeId ?? undefined;
  if (!finalTypeId) {
    const unknownType = await prisma.feedbackType.findFirst({
      where: { name: 'Unknown', isActive: true },
    });
    if (unknownType) finalTypeId = unknownType.id;
  }

  // Update sentiment + tạo action plans trong 1 transaction
  await prisma.$transaction(async (tx) => {
    await tx.feedback.update({
      where: { id: payload.feedbackId },
      data: {
        sentiment: analysis.sentiment,
        ...(finalTypeId ? { typeId: finalTypeId } : {}),
      },
    });

    if (analysis.suggestedActionPlans.length > 0) {
      await tx.feedbackActionPlan.createMany({
        data: analysis.suggestedActionPlans.map((plan) => ({
          feedbackId: payload.feedbackId,
          title: plan.title,
          description: plan.description ?? null,
          status: 'PENDING' as const,
        })),
      });
    }
  });

  console.log(
    `[AiWorker] Feedback #${payload.feedbackId} analyzed: ${analysis.sentiment}, ` +
    `${analysis.suggestedActionPlans.length} action plans created`
  );
}

// ── Message dispatcher ─────────────────────────────────────────

async function handleMessage(
  ch: Channel,
  routingKey: string,
  payload: unknown,
  deliveryTag: number,
): Promise<void> {
  try {
    switch (routingKey) {
      case AiEvent.PRODUCT_VECTOR_SYNC:
        await handleProductVectorSync(payload as ProductVectorSyncPayload);
        break;

      case AiEvent.FEEDBACK_ANALYZE:
        await handleFeedbackAnalyze(payload as FeedbackAnalyzePayload);
        break;

      default:
        console.warn(`[AiWorker] Unknown routing key: ${routingKey} — acking to drop`);
    }

    ch.ack({ fields: { deliveryTag } } as Parameters<Channel['ack']>[0]);
  } catch (err) {
    console.error(`[AiWorker] Failed to handle ${routingKey}:`, err);
    // NACK → message vào DLQ để debug, không requeue tránh loop
    ch.nack(
      { fields: { deliveryTag } } as Parameters<Channel['nack']>[0],
      false,
      false,
    );
  }
}

async function startConsuming(ch: Channel): Promise<void> {
  await ch.consume(QUEUE_AI, (msg) => {
    if (!msg) return;
    let payload: unknown;
    try {
      payload = JSON.parse(msg.content.toString('utf8'));
    } catch {
      payload = {};
    }
    handleMessage(ch, msg.fields.routingKey, payload, msg.fields.deliveryTag).catch((err) =>
      console.error('[AiWorker] Floating Promise Error in handleMessage:', err)
    );
  });

  console.log(`[AiWorker] Consuming from ${QUEUE_AI}`);
}

// ── Connection lifecycle (copy pattern từ email.worker.ts) ─────

let activeConn: ChannelModel | null = null;
let isShuttingDown = false;

async function run(): Promise<void> {
  const url = process.env.RABBITMQ_URL?.trim();
  if (!url) throw new Error('RABBITMQ_URL is not configured');

  while (true) {
    if (isShuttingDown) break;
    try {
      const conn: ChannelModel = await connect(url);
      activeConn = conn;

      conn.on('error', (err: Error) => console.error('[AiWorker] Connection error:', err));
      conn.on('close', () => {
        activeConn = null;
        if (isShuttingDown) return;
        console.warn('[AiWorker] Connection closed, reconnecting...');
      });

      const ch = await setupChannel(conn);
      ch.on('error', (err: Error) => console.error('[AiWorker] Channel error:', err));

      await startConsuming(ch);

      await new Promise<void>((resolve) => {
        conn.on('close', resolve);
      });
    } catch (err) {
      console.error('[AiWorker] Startup error, retrying in', RECONNECT_DELAY_MS, 'ms:', err);
    }

    if (isShuttingDown) break;
    await new Promise<void>((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[AiWorker] Received ${signal} — closing connection gracefully...`);

  const forceKillTimer = setTimeout(() => {
    console.error('[AiWorker] Force kill — timeout exceeded (8s)');
    process.exit(1);
  }, 8_000); // Phải < kill_timeout (10s) trong ecosystem.config.js, chừa 2s buffer
  forceKillTimer.unref();

  try {
    if (activeConn) {
      await activeConn.close();
      console.log('[AiWorker] RabbitMQ connection closed cleanly');
    }
    await prisma.$disconnect();
  } catch (err) {
    console.error('[AiWorker] Error during shutdown:', err);
  }

  console.log('[AiWorker] Exited cleanly.');
  process.exit(0);
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[AiWorker FATAL] Unhandled Promise Rejection:', reason);
  void gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (error: Error) => {
  console.error('[AiWorker FATAL] Uncaught Exception:', error);
  void gracefulShutdown('uncaughtException');
});

run().catch((err) => {
  console.error('[AiWorker] Fatal error:', err);
  process.exit(1);
});
