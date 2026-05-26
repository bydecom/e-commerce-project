import { prisma } from '../../db';
import { ensureRedisConnected, redisClient } from '../../config/redis';
import { publishFeedbackAnalyze } from '../../rabbitmq/publisher';

const SWEEPER_LOCK_KEY = 'feedback:sweeper:lock';

export function startFeedbackSweeperLoop(opts?: {
  intervalMs?: number;
  batchSize?: number;
}): { stop: () => void } {
  const intervalMs = Math.max(5_000, Math.floor(opts?.intervalMs ?? 30_000)); // Quét mặc định mỗi 30 giây
  const batchSize = Math.max(5, Math.floor(opts?.batchSize ?? 20));
  // Lock TTL ngắn hơn interval để tránh khóa chết nếu instance crash
  const lockTtlSeconds = Math.max(2, Math.ceil(intervalMs / 1000) - 2);

  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) return;
    void (async () => {
      try {
        await ensureRedisConnected();
        const redis = redisClient();

        // Thử lấy khóa phân tán (SETNX + TTL)
        const acquired = await redis.set(SWEEPER_LOCK_KEY, process.pid.toString(), {
          NX: true, // Chỉ set nếu key chưa tồn tại
          EX: lockTtlSeconds,
        });
        if (!acquired) return; // Instance khác đã nắm giữ lock -> bỏ qua tick này

        const cutoff = new Date(Date.now() - 30 * 60 * 1000); // Kẹt quá 30 phút

        // Dùng SQL Raw để thực hiện phép so sánh chéo cột "updatedAt" = "createdAt" tối ưu
        const orphanedFeedbacks = await prisma.$queryRaw<{ id: number; comment: string | null }[]>`
          SELECT id, comment FROM "Feedback"
          WHERE sentiment = 'PENDING'::"SentimentLabel"
            AND "createdAt" < ${cutoff}
            AND "updatedAt" = "createdAt"
            AND comment IS NOT NULL
          LIMIT ${batchSize}
        `;

        if (!orphanedFeedbacks.length) return;

        // eslint-disable-next-line no-console
        console.log(`[FeedbackSweeper] Found ${orphanedFeedbacks.length} orphaned pending feedbacks to republish.`);

        const publishPromises = orphanedFeedbacks
          .filter((fb) => fb.comment)
          .map((fb) => {
            return publishFeedbackAnalyze({
              feedbackId: fb.id,
              comment: fb.comment!.trim(),
            })
              .then(() => {
                // eslint-disable-next-line no-console
                console.log(`[FeedbackSweeper] Successfully republished feedback #${fb.id}`);
              })
              .catch((err) => {
                // eslint-disable-next-line no-console
                console.error(`[FeedbackSweeper] Failed to republish feedback #${fb.id}:`, err);
              });
          });

        if (publishPromises.length > 0) {
          await Promise.allSettled(publishPromises);
        }
      } catch (err) {
        // Tránh làm sập tiến trình backend nếu DB hoặc Redis gặp sự cố
        // eslint-disable-next-line no-console
        console.error('[FeedbackSweeper Error]:', err);
      }
    })();
  }, intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
