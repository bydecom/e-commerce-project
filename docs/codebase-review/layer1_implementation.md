# 🔱 Layer 1 — Process & Runtime: Implementation Complete

> **Build:** ✅ `tsc --noEmit` passed  
> **Tests:** ✅ 28/28 passed  
> **Date:** 2026-05-21

---

## Tổng quan thay đổi

5 mục của Layer 1 đã được implement cùng lúc vì chúng phụ thuộc lẫn nhau:

| # | Mục | File thay đổi | Trạng thái |
|---|---|---|---|
| 1.1 | Graceful Shutdown Handler | [index.ts](file:///d:/Workspace/Project/e-commerce-project/backend/index.ts) | ✅ Done |
| 1.2 | Unhandled Rejection & Uncaught Exception | [index.ts](file:///d:/Workspace/Project/e-commerce-project/backend/index.ts) | ✅ Done |
| 1.3 | PM2 Cluster Mode | [ecosystem.config.js](file:///d:/Workspace/Project/e-commerce-project/backend/ecosystem.config.js) | ✅ Done |
| 1.4 | Rate Limit Redis Store | [app.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/app.ts) | ✅ Done |
| 1.5 | Cleanup Loop Distributed Lock | [stock-reservation.service.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/inventory/stock-reservation.service.ts) | ✅ Done |

---

## Chi tiết từng mục

### 1.1 Graceful Shutdown Handler — `index.ts`

```diff
+process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
+process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
```

**Logic shutdown:**
1. `stopCleanupLoop()` — dừng cleanup interval
2. `server.close()` — dừng nhận connection mới, drain existing requests
3. `prisma.$disconnect()` + `redis.quit()` + `closeRabbitConnection()` — đóng DB/cache/MQ
4. `process.exit(0)` — thoát sạch
5. Force kill sau 10s nếu có request stuck (`setTimeout + process.exit(1)`)

**Bonus fix:** Thêm `keepAliveTimeout: 30s` và `headersTimeout: 35s` cho HTTP server để chống tấn công Slowloris. Xóa hardcoded IP `3.25.162.48` ra khỏi log.

### 1.2 Unhandled Rejection & Uncaught Exception — `index.ts`

```diff
+process.on('unhandledRejection', (reason) => {
+  console.error('[FATAL] Unhandled Promise Rejection:', reason);
+  void gracefulShutdown('unhandledRejection');
+});
+
+process.on('uncaughtException', (error) => {
+  console.error('[FATAL] Uncaught Exception:', error);
+  void gracefulShutdown('uncaughtException');
+});
```

Thay vì để Node.js kill process ngay lập tức → log lỗi + chạy graceful shutdown flow bình thường.

### 1.3 PM2 Cluster Mode — `ecosystem.config.js`

```diff
-instances: 1,
+instances: 'max',
+exec_mode: 'cluster',
+kill_timeout: 10000,    // Match forceKillTimer in index.ts
+listen_timeout: 8000,   // Zero-downtime: wait for new instance ready (Nâng lên 8000ms ở Round 7)
```

- `'max'` = tận dụng hết CPU cores trên EC2
- `kill_timeout: 10000` = PM2 chờ 10s cho graceful shutdown trước khi SIGKILL
- `listen_timeout: 8000` = đợi instance mới sẵn sàng 8s trước khi kill instance cũ (Nâng lên từ 3000 ở Round 7 để phù hợp cold start Neon)
- Email worker giữ nguyên `fork` mode (1 instance) — RabbitMQ tự handle concurrency

### 1.4 Rate Limit Redis Store — `app.ts`

```diff
+import RedisStore from 'rate-limit-redis';
+
+function createRateLimitStore() {
+  if (process.env.NODE_ENV !== 'production') return undefined;
+  return new RedisStore({
+    sendCommand: (...args) => redisClient().sendCommand(args),
+  });
+}
+
 const globalLimiter = rateLimit({
+  store: createRateLimitStore(),
   // ... existing config
 });
```

- Production: dùng RedisStore → 1 counter chia sẻ giữa tất cả cluster instances
- Development: giữ nguyên MemoryStore mặc định (không cần Redis chạy local)
- Nếu RedisStore khởi tạo lỗi → fallback về MemoryStore + log warning

### 1.5 Cleanup Loop Distributed Lock — `stock-reservation.service.ts`

```diff
+const CLEANUP_LOCK_KEY = 'stock:cleanup:lock';
+
 export function startReservationCleanupLoop(...) {
+  const lockTtlSeconds = Math.max(1, Math.ceil(intervalMs / 1000) - 1);
+
   // Inside setInterval callback:
+  const acquired = await redis.set(CLEANUP_LOCK_KEY, process.pid.toString(), {
+    NX: true,   // SETNX — only set if key doesn't exist
+    EX: lockTtlSeconds,  // Auto-expire = interval - 1s
+  });
+  if (!acquired) return; // Another instance holds the lock — skip
```

- SETNX: chỉ instance nào set được lock mới chạy cleanup
- Lock TTL = `interval - 1s` (4s cho interval 5s) → auto-expire trước tick tiếp theo
- `process.pid` làm lock value → dễ debug xem instance nào đang giữ lock
- Instance bị crash: lock tự hết hạn sau 4s, instance khác sẽ nhận tiếp

### Bổ sung: `closeRabbitConnection()` — `config/rabbitmq.ts`

```diff
+export async function closeRabbitConnection(): Promise<void> {
+  if (_channel) { await _channel.close(); _channel = null; }
+  if (_conn) { await _conn.close(); _conn = null; }
+}
```

Export thêm hàm đóng connection RabbitMQ sạch sẽ cho graceful shutdown sử dụng.

---

## Dependency mới

```
rate-limit-redis  (npm install rate-limit-redis)
```

---

## Cách test thủ công

### Test Graceful Shutdown
```bash
# Trên EC2:
pm2 reload bandai-api --env production

# Quan sát log:
pm2 logs bandai-api --lines 20
# Expect: "[Shutdown] SIGTERM received — closing gracefully..."
# Expect: "[Shutdown] HTTP server(s) closed"
# Expect: "[Shutdown] All connections closed — exiting cleanly."
```

### Test Rate Limit Redis Store
```bash
# Gửi 151 requests liên tiếp:
for i in $(seq 1 151); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health; done
# Expect: 150 × "200", sau đó "429"
```

### Test Distributed Lock
```bash
# Chạy PM2 cluster 4 instances, quan sát Redis:
redis-cli GET stock:cleanup:lock
# Expect: PID của 1 instance duy nhất
```
