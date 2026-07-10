# 🗺️ Round 12 Strategy Blueprint — EDA Reliability & Production Hardening

> **Bối cảnh:** Sau 11 round review và implement, hệ thống đã đạt 92.3% hoàn thành (36/39 tasks R1–R11). Một bài phản biện độc lập từ Senior Mentor đã chỉ ra rằng kiến trúc EDA hiện tại là **"hợp lý cho mock project đã deploy cloud"** nhưng còn thiếu nhiều cơ chế reliability để gọi là production-grade. Round 12 được thiết kế dựa trên những gap đó.
> **Mục tiêu:** Ghi nhận đầy đủ những gì hệ thống **đã có**, và lập bản đồ rõ ràng cho những gì **cần bổ sung** khi scale lên production thật.
> **Trạng thái:** 🔲 **Backlog**
> **Tracking:** Các mục ưu tiên đã được kéo vào [`master_checklist.md`](./master_checklist.md) §10 (audit 2026-07-10).

---

## 📊 ĐÁNH GIÁ TRUNG THỰC: ĐÃ CÓ GÌ vs CÒN THIẾU GÌ

### ✅ Những gì hệ thống ĐÃ LÀM ĐÚNG (Round 1–11)

| # | Capability | Bằng chứng trong code | Đánh giá |
|---|---|---|---|
| 1 | **Manual ACK/NACK** | `ai.worker.ts:162` — `ch.ack()` khi success, `ch.nack(false, false)` khi fail | ✅ Chuẩn — Consumer không auto-ack, fail message → DLQ |
| 2 | **Persistent messages** | `rabbitmq.ts:62` — `persistent: opts.persistent ?? true` | ✅ Mặc định bật — Tin nhắn sống sót qua RabbitMQ restart |
| 3 | **Durable queues & exchanges** | `durable: true` trên tất cả queues/exchanges | ✅ Topology không mất khi broker restart |
| 4 | **DLQ với TTL + Max Length** | `x-message-ttl: 7 ngày`, `x-max-length: 500` (Round 11 fix) | ✅ DLQ tự dọn rác, không phình disk vô hạn |
| 5 | **Idempotency check AI worker** | `ai.worker.ts:90-93` — Skip nếu `sentiment !== 'PENDING'` | ✅ Chống duplicate Gemini API call |
| 6 | **Re-check DB trước cancel** | `order.service.ts:357` — Check `status !== 'PENDING' \|\| paymentStatus === 'PAID'` | ✅ Chống cancel nhầm order đã thanh toán |
| 7 | **Prefetch = 1** | AI worker prefetch tuning | ✅ Chống rate limit Gemini API |
| 8 | **Graceful shutdown** | `process.on('SIGTERM')` trong cả 2 workers | ✅ Không mất message khi PM2 reload |
| 9 | **Prisma Singleton** | Duy nhất `new PrismaClient()` trong `db.ts` | ✅ Không rò rỉ connection pool |
| 10 | **Floating point defense** | `Math.round()` trong order total + VNPay amount | ✅ Phòng thủ precision drift |

### ❌ Những gì CÒN THIẾU cho production-grade EDA

| # | Gap | Rủi ro | Mức ưu tiên | Phase đề xuất |
|---|---|---|---|---|
| 1 | **Publisher Confirms** | `publish()` là fire-and-forget. Nếu broker reject message (disk full, policy violation), publisher không biết → event mất | 🟡 Trung bình | Phase 12A |
| 2 | **Transactional Outbox Pattern** | App crash sau DB commit nhưng trước RabbitMQ publish → order tạo thành công nhưng event không bao giờ gửi → email mất, vector không sync | 🟡 Trung bình | Phase 12B |
| 3 | **Retry strategy có kiểm soát** | Hiện tại: fail → NACK thẳng vào DLQ. Không có retry 1-2 lần trước khi DLQ | 🟡 Thấp | Phase 12A |
| 4 | **Order TTL bằng RabbitMQ DLX** | Hiện dùng Redis cleanup loop (polling). RabbitMQ TTL+DLX sẽ tinh tế hơn (broker handle timer) | 🟢 Cải tiến | Phase 12C |
| 5 | **DLQ Monitoring & Alert** | Chỉ có TTL auto-expire, không có alert khi DLQ tích lũy (Telegram/Slack bot) | 🟡 Trung bình | Phase 12A |
| 6 | **Deep Pagination cap MAX_PAGE** | `parsePagination` cap `limit=100` nhưng chưa cap `page` tối đa | 🟢 Cải tiến | Phase 12A |
| 7 | **Cursor-based Pagination** | Hiện dùng offset-based. Cursor-based tốt hơn cho dataset lớn | 🟢 Cải tiến dài hạn | Phase 12C |
| 8 | **RabbitMQ HA / Managed Broker** | App + RabbitMQ cùng EC2. EC2 sập = mất cả hai | 🟡 Trung bình | Phase 12C |

---

## 🛠️ ROUND 12 — PHÂN PHASE CHI TIẾT

### Phase 12A — Quick Wins (1–2 ngày)

> **Nguyên tắc:** Những thay đổi nhỏ, low-risk, không cần refactor lớn.

#### Task 12A.1 — Publisher Confirms
```typescript
// Thay createChannel() bằng createConfirmChannel()
_channel = await _conn.createConfirmChannel();

// Sau mỗi publish critical:
await ch.waitForConfirms(); // block cho đến khi broker ACK
```
- **File cần sửa:** `config/rabbitmq.ts`
- **Rủi ro fix:** Thấp — chỉ đổi channel type
- **Lợi ích:** Biết chắc broker đã nhận message

#### Task 12A.2 — Retry trước DLQ (Optional)
```typescript
// Thêm x-delivery-count check trong worker:
const retryCount = (msg.properties.headers?.['x-death']?.[0]?.count ?? 0);
if (retryCount < 3) {
  ch.nack(msg, false, true); // requeue để retry
} else {
  ch.nack(msg, false, false); // hết retry → DLQ
}
```
- **Cân nhắc:** Có thể gây retry storm nếu lỗi là permanent (ví dụ Gemini API key hết hạn). Cần kết hợp exponential backoff hoặc chỉ retry cho transient errors.

#### Task 12A.3 — DLQ Alert (Lightweight)
```typescript
// Thêm vào cleanup loop hoặc schedule riêng:
const dlqInfo = await ch.checkQueue(QUEUE_AI_DLQ);
if (dlqInfo.messageCount > 10) {
  console.error(`[ALERT] DLQ ${QUEUE_AI_DLQ} has ${dlqInfo.messageCount} dead messages!`);
  // Phase sau: Gọi Telegram Bot API / Slack Webhook
}
```
- **File cần sửa:** `stock-reservation.service.ts` (cleanup loop) hoặc tạo file mới `dlq-monitor.service.ts`

#### Task 12A.4 — Pagination MAX_PAGE Guard
```typescript
// utils/pagination.ts
const MAX_PAGE = 500;
const page = Math.min(MAX_PAGE, Math.max(1, parseInt(query.page ?? '1', 10) || 1));
```
- **File cần sửa:** `utils/pagination.ts`
- **Rủi ro fix:** Zero — chỉ thêm 1 dòng

---

### Phase 12B — Architectural Pattern (3–5 ngày)

> **Nguyên tắc:** Thay đổi kiến trúc có ý nghĩa, cần thiết kế cẩn thận.

#### Task 12B.1 — Transactional Outbox Pattern

**Vấn đề hiện tại:**
```
DB Transaction COMMIT ✅ → App crash 💥 → RabbitMQ publish NEVER happens
→ Order created but email never sent, vector never synced
```

**Giải pháp:**
```
1. Tạo bảng `outbox_events` trong Prisma schema
2. Trong cùng DB transaction: INSERT order + INSERT outbox event
3. Worker riêng (outbox-publisher) poll bảng outbox → publish → mark as sent
4. Nếu app crash → outbox event vẫn nằm trong DB → worker pick up lại
```

**Prisma Schema bổ sung:**
```prisma
model OutboxEvent {
  id         Int      @id @default(autoincrement())
  exchange   String
  routingKey String
  payload    Json
  status     String   @default("PENDING") // PENDING | SENT | FAILED
  createdAt  DateTime @default(now())
  sentAt     DateTime?
  
  @@index([status, createdAt])
}
```

**Trade-off:** Thêm complexity + thêm DB writes. Chỉ nên apply cho **critical events** (order emails, payment notifications). Không cần cho AI vector sync (best-effort là đủ).

---

### Phase 12C — Long-term (Khi scale thật)

> **Nguyên tắc:** Chỉ khi traffic/data thật sự đòi hỏi.

#### Task 12C.1 — Order TTL bằng RabbitMQ DLX
Thay thế Redis cleanup loop bằng message TTL + Dead Letter Exchange. Broker tự handle timer thay vì app code phải poll.

#### Task 12C.2 — Cursor-based Pagination
Thay `skip/take` bằng `cursor/take` cho các API listing có dataset lớn (>100K records).

#### Task 12C.3 — Managed RabbitMQ / Cluster
Tách RabbitMQ ra khỏi EC2. Dùng CloudAMQP managed service hoặc setup RabbitMQ cluster riêng để đảm bảo HA.

---

## 📋 CHECKLIST TỔNG HỢP

| Task | Mô tả | Ưu tiên | Trạng thái |
|---|---|---|---|
| 12A.1 | Publisher Confirms | 🟡 | 🔲 Chờ |
| 12A.2 | Retry trước DLQ | 🟢 | 🔲 Chờ |
| 12A.3 | DLQ Alert (Lightweight) | 🟡 | 🔲 Chờ |
| 12A.4 | Pagination MAX_PAGE Guard | 🟢 | 🔲 Chờ |
| 12B.1 | Transactional Outbox Pattern | 🟡 | 🔲 Chờ |
| 12C.1 | Order TTL bằng RabbitMQ DLX | 🟢 | 🔲 Chờ |
| 12C.2 | Cursor-based Pagination | 🟢 | 🔲 Chờ |
| 12C.3 | Managed RabbitMQ / HA | 🟢 | 🔲 Chờ |

---

## 🎓 BÀI HỌC TỪ BÀI PHẢN BIỆN ĐỘC LẬP

> [!IMPORTANT]
> **Nhận xét gốc:** *"Đây là một architecture refactor hợp lý cho mock project đã deploy cloud, giúp bạn học EDA rất tốt. Nhưng để tiến gần production, bạn cần bổ sung reliability concerns như publisher confirms, manual ack, retry/DLQ, idempotency, monitoring, và transactional outbox."*

**Những gì đã đáp ứng được từ nhận xét trên:**
- ✅ Manual ACK — đã có
- ✅ DLQ — đã có + TTL
- ✅ Idempotency — đã có (AI worker)
- ✅ Persistent messages — đã có
- ✅ Durable topology — đã có
- ✅ Re-check DB trước cancel — đã bổ sung Round 11

**Những gì cần bổ sung:**
- 🔲 Publisher Confirms
- 🔲 Transactional Outbox
- 🔲 Retry strategy
- 🔲 DLQ Monitoring/Alert
- 🔲 Broker HA

> [!NOTE]
> Round 12 được thiết kế như bản đồ **"biết mà chưa cần làm ngay"**. Mục đích là ghi nhận knowledge gap một cách trung thực, để khi cần scale lên production thật, bạn biết chính xác cần làm gì mà không phải tìm hiểu lại từ đầu.
