# 🔱 Master Checklist: Bản Đồ Bám Sát Tiến Độ Go-Live (R1 → R12)

Tài liệu này tổng hợp nhiệm vụ, cải tiến kiến trúc, và sửa lỗi bảo mật/hiệu năng từ **Round 1 → Round 11** (đã ship), cộng **Round 12 backlog**.

Nguồn gốc: [`technical_critique.md`](./technical_critique.md), [`plan_vs_reality.md`](./plan_vs_reality.md), [`round_12_strategy_blueprint.md`](./round_12_strategy_blueprint.md).

> **Audit đối chiếu code:** 2026-07-10 — đã quét lại repo; các mục `[x]` bên dưới khớp implementation hiện tại trừ ghi chú ⚠️ (nếu có). Link dùng path tương đối trong repo (không còn `file:///d:/...`).

---

## 📊 TỔNG QUAN TIẾN ĐỘ CHUNG

### Phạm vi R1 → R11 (đã đóng vòng)

| Tầng Phân Tích (Layers) | Tổng Task | Done | Backlog | Tỉ lệ |
|---|---|---|---|---|
| **Layer 1 — Process & Runtime** | 5 | 5 | 0 | 100% ✅ |
| **Layer 2 — Database & Connection** | 3 | 3 | 0 | 100% ✅ |
| **Layer 3 — Async Queue & Workers** | 6 | 6 | 0 | 100% ✅ |
| **Layer 4 — Storage & Cloud CDN** | 3 | 3 | 0 | 100% ✅ |
| **Layer 5 — CI/CD & Deploy Pipelines** | 4 | 4 | 0 | 100% ✅ |
| **Layer 6 — Security & DevOps** | 6 | 6 | 0 | 100% ✅ |
| **Layer 7 — Testing & Verification** | 3 | 3 | 0 | 100% ✅ |
| **Layer 8 — Observability** | 3 | 0 | 3 | 0% 🔲 |
| **UX & Kiến Trúc Phát Sinh (Bonus)** | 6 | 6 | 0 | 100% ✅ |
| **TỔNG R1–R11** | **39** | **36** | **3** | **92.3%** |

### Round 12 — EDA Reliability (chưa tính vào 39)

| Phase | Task trong checklist này | Trạng thái |
|---|---|---|
| 12A / 12B / 12C | 6 mục ưu tiên (rút từ blueprint 8 gaps) | 🔲 Backlog |
| **Gộp R1–R12 (checklist này)** | **45** | **36 done / 9 open** (~80% nếu tính cả R12) |

> Round 12 blueprint còn thêm *Retry trước DLQ* và *Cursor pagination* — chưa liệt kê ở đây vì ưu tiên thấp hơn / dài hạn. Xem [`round_12_strategy_blueprint.md`](./round_12_strategy_blueprint.md).

---

## 🛠️ CHI TIẾT CHECKLIST THEO TỪNG PHÂN LỚP

### 1. 🏎️ LAYER 1 — PROCESS & RUNTIME
*Mục tiêu: App chạy mượt, stateless, chịu tải, không crash / rò rỉ tài nguyên.*

- [x] **SIGTERM & SIGINT Graceful Shutdown**
  - *Chi tiết:* `stopCleanupLoop()` → đóng HTTP servers → `prisma.$disconnect()` + Redis `quit` + `closeRabbitConnection()`. Force kill 10s (`.unref()`). Email/AI workers có shutdown riêng.
  - *File:* [`backend/index.ts`](../../backend/index.ts) · [`email.worker.ts`](../../backend/src/workers/email.worker.ts) · [`ai.worker.ts`](../../backend/src/workers/ai.worker.ts)

- [x] **Unhandled Rejection & Uncaught Exception**
  - *Chi tiết:* Log fatal → gọi `gracefulShutdown()` thay vì zombie process.
  - *File:* [`backend/index.ts`](../../backend/index.ts)

- [x] **PM2 Cluster & Zero-Downtime Reload**
  - *Chi tiết:* `instances: 'max'`, `exec_mode: 'cluster'`, `wait_ready: true`, `listen_timeout: 8000` (Neon cold start), `process.send?.('ready')`, `kill_timeout: 10000`.
  - *File:* [`backend/ecosystem.config.js`](../../backend/ecosystem.config.js)

- [x] **Rate Limit Phân Hóa & Redis Store**
  - *Chi tiết:* Production dùng `RedisStore` (shared counter across cluster). `authRateLimiter` max **20**/15m, `aiRateLimiter` max **10**/15m, global **150**/15m. Dev skip / MemoryStore.
  - ⚠️ *Nuance:* `catch` khi **tạo** RedisStore fail → fallback MemoryStore. Runtime Redis down giữa chừng vẫn có thể làm request rate-limit lỗi (không phải full circuit-breaker) — chấp nhận được cho scope hiện tại.
  - *File:* [`backend/src/app.ts`](../../backend/src/app.ts)

- [x] **Cleanup Loop Distributed Lock**
  - *Chi tiết:* Redis `SET` + `NX` + `EX` (SETNX semantics) — chỉ 1 PM2 instance chạy cleanup reservation hết hạn.
  - *File:* [`stock-reservation.service.ts`](../../backend/src/modules/inventory/stock-reservation.service.ts)

---

### 2. 🗄️ LAYER 2 — DATABASE & CONNECTION (Neon)
*Mục tiêu: Bảo vệ connection pool Neon + giảm IOPS thừa.*

- [x] **Neon Connection Pool Limit**
  - *Chi tiết:* `connection_limit=3` trên `DATABASE_URL` production.
  - *File:* `backend/.env.production` (local trên EC2, **không** commit secrets)

- [x] **Gỡ DB System Logger khỏi HTTP hot path**
  - *Chi tiết:* `dbLoggerMiddleware` ghi **stdout JSON** (PM2 logs), không `prisma.systemLog.create()` mỗi request.
  - ⚠️ *Nuance:* Route `/api/system-logs` vẫn còn mount (đọc dữ liệu cũ / admin) — không còn write-per-request. Dashboard có thể ẩn link tùy FE.
  - *File:* [`logger.middleware.ts`](../../backend/src/middlewares/logger.middleware.ts)

- [x] **Database Connection qua SSL**
  - *Chi tiết:* Neon URL dùng `sslmode=require` (và channel binding nếu portal yêu cầu) trên env production.
  - *File:* `backend/.env.production` (EC2 only)

---

### 3. 🐇 LAYER 3 — ASYNC QUEUE & WORKERS
*Mục tiêu: Đưa job nặng (Gemini / email) ra khỏi HTTP.*

**Queue names thật trong code** ([`events.enum.ts`](../../backend/src/rabbitmq/events.enum.ts)):

| Vai trò | Queue / Exchange |
|---|---|
| Email auth | `q.notification.email.auth` · exchange `ex.notification` |
| Email order | `q.notification.email.order` (+ DLQ `q.notification.email.order.dlq`) |
| AI tasks | `q.ai.tasks` (+ DLQ `q.ai.tasks.dlq`) · exchange `ex.ai` |
| Dead letters | exchange `ex.dlq` |

> ❌ Tên cũ trong doc trước đây (`q.auth.tasks` / `q.order.tasks`) **không đúng** — đã sửa ở bản audit này.

- [x] **Bất đồng bộ Qdrant Vector Sync**
  - *Chi tiết:* Admin save product AVAILABLE → `publishProductVectorSync` → AI worker embed + upsert (kèm price/category trong text). HTTP không chờ Gemini.
  - *File:* [`product.service.ts`](../../backend/src/modules/product/product.service.ts) · [`ai.worker.ts`](../../backend/src/workers/ai.worker.ts) · [`ai.service.ts`](../../backend/src/modules/ai/ai.service.ts)

- [x] **Phân tích Feedback ngầm**
  - *Chi tiết:* Feedback `sentiment: PENDING` → publish → worker Gemini classify type/sentiment + action plans. Idempotent: skip nếu không còn `PENDING`.
  - *File:* [`feedback.service.ts`](../../backend/src/modules/feedback/feedback.service.ts) · [`feedback-analyzer.ts`](../../backend/src/modules/ai/feedback/feedback-analyzer.ts)

- [x] **VNPay IPN giữ sync trong transaction**
  - *Chi tiết:* IPN verify + DB update trong `$transaction`; side-effects (mail / release stock) tách `.catch()` ngoài.
  - *File:* [`vnpay.controller.ts`](../../backend/src/modules/payment/vnpay.controller.ts) · [`vnpay.service.ts`](../../backend/src/modules/payment/vnpay.service.ts)

- [x] **Tách queue theo loại job + DLQ**
  - *Chi tiết:* Email vs AI tách queue. DLQ có **TTL 7 ngày** + **max-length 500** (AI DLQ + order email DLQ) — chống “thùng rác không đổ”.
  - *File:* [`ai.worker.ts`](../../backend/src/workers/ai.worker.ts) · [`email.worker.ts`](../../backend/src/workers/email.worker.ts)

- [x] **Orphaned Feedback Sweeper**
  - *Chi tiết:* Quét feedback `PENDING` quá hạn; Redis lock `feedback:sweeper:lock`; republish `Promise.allSettled`.
  - *File:* [`feedback-sweeper.service.ts`](../../backend/src/modules/feedback/feedback-sweeper.service.ts)

- [x] **RabbitMQ Prefetch + Gemini Timeout**
  - *Chi tiết:* AI worker `prefetch = 1`. Gemini calls bọc `withTimeout` (~15s) trong provider.
  - *File:* [`ai.worker.ts`](../../backend/src/workers/ai.worker.ts) · [`gemini.provider.ts`](../../backend/src/modules/ai/providers/gemini.provider.ts)

---

### 4. ☁️ LAYER 4 — STORAGE & CLOUD CDN

- [x] **CloudFront CDN cho ảnh**
  - *Chi tiết:* `CLOUDFRONT_URL` → `publicUrl` trả client đi qua CDN; fallback MinIO endpoint / S3 URL.
  - *File:* [`upload.service.ts`](../../backend/src/modules/upload/upload.service.ts)

- [x] **Upload security (Task 4.3)**
  - *Chi tiết:* Query bắt buộc `size`; max **5MB**; allowlist mime + ext (`jpg/jpeg/png/webp/gif`). FE nén bằng `browser-image-compression` (thường → webp nhẹ).
  - *File:* [`upload.controller.ts`](../../backend/src/modules/upload/upload.controller.ts) · [`frontend/.../upload.service.ts`](../../frontend/src/app/core/services/upload.service.ts)

- [x] **S3 Bucket Policy & CloudFront OAC (Task 4.2)**
  - *Chi tiết:* Chặn public S3 trực tiếp; GET qua OAC; CORS cho Presigned PUT.
  - *Trạng thái:* ✅ Cấu hình trên AWS (infra) — không nằm trong source code app.

---

### 5. 🚀 LAYER 5 — CI/CD & DEPLOY

- [x] **Smart Auto-Rollback (Task 5.1)**
  - *Chi tiết:* Backup `dist` → deploy → smoke `GET /api/health` (curl `--retry 3`) → fail thì restore `dist.backup` + `pm2 reload`.
  - *File:* [`.github/workflows/deploy-backend.yml`](../../.github/workflows/deploy-backend.yml)

- [x] **Dynamic CORS / CLIENT_URL**
  - *Chi tiết:* Không hardcode IP/domain; strip trailing slash trên `CLIENT_URL`.
  - *File:* [`app.ts`](../../backend/src/app.ts)

- [x] **Frontend S3 Sync + CloudFront Invalidation**
  - *File:* [`.github/workflows/deploy-frontend.yml`](../../.github/workflows/deploy-frontend.yml)

- [x] **Jest CI + coverage artifact**
  - *File:* [`.github/workflows/test.yml`](../../.github/workflows/test.yml)

---

### 6. 🔒 LAYER 6 — SECURITY & DEVOPS

- [x] **RabbitMQ Security Hardening**
  - *Chi tiết:* `docker-compose.prod.yml` **không** publish port `5672`/`15672` ra host public; credentials từ `${RABBITMQ_USER}` / `${RABBITMQ_PASS}`.
  - *File:* [`docker-compose.prod.yml`](../../docker-compose.prod.yml)

- [x] **Không dùng `$queryRawUnsafe`**
  - *Chi tiết:* Raw SQL dùng tagged `$queryRaw` (parameterized). Audit 2026-07-10: **0** match `queryRawUnsafe` trong `backend/src`.
  - *Ví dụ:* [`product.service.ts`](../../backend/src/modules/product/product.service.ts) · sweeper

- [x] **JWT Blacklist Hybrid Fail-Open / Fail-Closed**
  - *Chi tiết:* Redis down: nếu token còn TTL **> 5 phút** → Fail-Closed (reject); **≤ 5 phút** → Fail-Open (cho qua) — cân bằng security vs availability.
  - *File:* [`backend/src/utils/jwt-blacklist.ts`](../../backend/src/utils/jwt-blacklist.ts)
  - ❌ *Sửa lỗi doc cũ:* không còn path `modules/auth/jwt-blacklist.ts`.

- [x] **PM2 IPv4 DNS order**
  - *Chi tiết:* `node_args: '--dns-result-order=ipv4first'` cho API + workers.
  - *File:* [`ecosystem.config.js`](../../backend/ecosystem.config.js)

- [x] **PM2 Logrotate**
  - *Chi tiết:* Module logrotate trên EC2 (`max_size` / `retain` / `compress`) — cấu hình server, không trong git app.

- [x] **Credentials khỏi Git**
  - *Chi tiết:* `.env.production` gitignored; chỉ tồn tại trên EC2 / máy local.

---

### 7. 🧪 LAYER 7 — TESTING & VERIFICATION

- [x] **VNPay signature & IPN tests — 25 cases**
  - *File:* [`vnpay.service.test.ts`](../../backend/src/modules/payment/__tests__/vnpay.service.test.ts) *(đếm `it(` = 25, audit 2026-07-10)*

- [x] **Stock reservation Lua / idempotency — 19 cases**
  - *File:* [`stock-reservation.service.test.ts`](../../backend/src/modules/inventory/__tests__/stock-reservation.service.test.ts) *(đếm = 19)*

- [x] **Best-effort Redis swallow trên attach orderId**
  - *Chi tiết:* `attachReservationOrderIdBestEffort` bọc try/catch — Redis lỗi không làm gãy checkout.
  - *File:* [`stock-reservation.service.ts`](../../backend/src/modules/inventory/stock-reservation.service.ts) (~L238+)

**Test modules khác (không nằm trong 3 task Layer 7 nhưng có trong repo):** auth, order, cart, product.

---

### 8. 🔮 LAYER 8 — OBSERVABILITY (Phase sau)

- [ ] **8.1 Centralized Logging** — Loki / ELK + correlation / transaction id
- [ ] **8.2 Metrics & Grafana** — CPU/RAM, Neon pool, RabbitMQ depth
- [ ] **8.3 APM** — latency HTTP → Queue → Gemini → Postgres

---

### 🌟 9. UX & KIẾN TRÚC PHÁT SINH (BONUS)

- [x] **VNPay GMT+7** — `formatVnpDateGmt7` trong [`vnpay.service.ts`](../../backend/src/modules/payment/vnpay.service.ts)
- [x] **Auth cookie cross-domain** — `sameSite: 'none'` + `secure: true` ([`auth.controller.ts`](../../backend/src/modules/auth/auth.controller.ts))
- [x] **UX verify email countdown + VND formatting** — FE
- [x] **Zod query stripping fix** — `.extend()` trên order/product query schemas
- [x] **Hotline E.164** — regex đồng bộ BE Zod + FE form
- [x] **PM2 worker env injection** — workers load `.env.production` khi `NODE_ENV=production`

**Bonus đã có trong code / R9 (không đếm riêng trong bảng 39):** `app.set('etag', false)`; FE `orderUpdated$` invalidate cache admin orders.

---

### 🔮 10. ROUND 12 — EDA RELIABILITY (Backlog)

Chi tiết: [`round_12_strategy_blueprint.md`](./round_12_strategy_blueprint.md)

- [ ] **12A.1 Publisher Confirms** — `createConfirmChannel()` + `waitForConfirms()`
- [ ] **12A.3 DLQ Alert** — monitor depth → log / Telegram / Slack
- [ ] **12A.4 Pagination MAX_PAGE** — cap `page` trong `parsePagination`
- [ ] **12B.1 Transactional Outbox** — ghi `outbox_events` cùng DB tx, worker publish
- [ ] **12C.1 Order TTL via DLX** — thay / bổ sung Redis cleanup loop
- [ ] **12C.3 Managed RabbitMQ / HA** — tách broker khỏi single EC2

*(Tùy chọn blueprint, chưa tick vào checklist ưu tiên: 12A.2 retry-before-DLQ, cursor pagination.)*

---

## ✅ Kết luận audit nhanh (2026-07-10)

| Verdict | Ý nghĩa |
|---|---|
| **36/39 R1–R11 là thật** | Các mục Done đối chiếu được với code / workflow / compose |
| **Sửa doc** | Queue names, path `jwt-blacklist`, link `file://` tuyệt đối, line-number cứng dễ lệch |
| **Còn mở** | Layer 8 observability (3) + Round 12 EDA (6+) |
| **Không overclaim** | Rate-limit fallback & system-log route được ghi chú nuance |

Khi bàn giao: dùng checklist này + README sections [AI system](../../README.md#ai-system) / [Technical deep dive](../../README.md#technical-deep-dive) làm narrative; dùng folder này làm bằng chứng “đã bị production đấm và vá”.
