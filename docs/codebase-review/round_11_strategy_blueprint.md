# 🗺️ Round 11 Strategy Blueprint: Khóa Kín Đám Mây & Kiểm Chứng Tải Nặng

*Cập nhật: 2026-05-26*

Round 11 là chặng đường cuối cùng để đưa toàn bộ hệ thống E-Commerce về đích. Hai mảnh ghép còn lại tập trung vào **bảo mật hạ tầng đám mây (Cloud Security)** và **chứng minh tính toàn vẹn dữ liệu dưới tải nặng (Resilience Testing)**.

> [!IMPORTANT]
> Trước khi bắt đầu Round 11, một cuộc kiểm tra toàn diện (Full Audit) đã được thực hiện trên toàn bộ codebase để xác minh 100% các task từ Round 8, 9, 10 đã phản ánh đúng code thật.

---

## ✅ KẾT QUẢ KIỂM TRA TOÀN DIỆN (FULL AUDIT — Round 8 → 10)

### Round 8 — 7/7 Tasks ĐÃ XÁC MINH ✅

| # | Task | File kiểm chứng | Kết quả |
|---|------|-----------------|---------|
| 1 | Neon `connection_limit=3` | `.env.production` dòng 2 | ✅ `&connection_limit=3` có trong DATABASE_URL |
| 2 | RabbitMQ Security (đóng port 5672, env credentials) | `docker-compose.prod.yml` | ✅ Không còn `ports` block, dùng `${RABBITMQ_USER}` / `${RABBITMQ_PASS}` |
| 3 | CORS cleanup (`CLIENT_URL` env) | `app.ts` dòng 48-52 | ✅ `process.env.CLIENT_URL` với `.trim().replace(/\/$/, '')` |
| 4 | VNPay Signature Unit Test (25 cases) | `vnpay.service.test.ts` (24KB) | ✅ File tồn tại, 25 test cases |
| 5 | AI Rate Limiter (`aiRateLimiter`, `authRateLimiter`) | `app.ts` dòng 123, 140, 220, 228 | ✅ Cả hai limiter dùng `RedisStore`, mount trên `/api/ai` và `/api/auth` |
| 6 | Qdrant Async via RabbitMQ Worker | `product.service.ts` dòng 471, 534 → `publisher.ts` → `ai.worker.ts` dòng 144 | ✅ Luồng `publishProductVectorSync` → Worker consume hoàn chỉnh |
| 7 | Feedback AI Analysis Async (`PENDING` flow) | `feedback.service.ts` dòng 223 → `publisher.ts` → `ai.worker.ts` dòng 148 | ✅ Luồng `publishFeedbackAnalyze` → Worker consume + idempotency check |

### Round 9 — 5/5 Tasks ĐÃ XÁC MINH ✅

| # | Task | File kiểm chứng | Kết quả |
|---|------|-----------------|---------|
| 1 | Event Bus `orderUpdated$` (Stale Data Fix) | `order-api.service.ts` dòng 32-33, 130 | ✅ `Subject<number>` + `.next()` khi update |
| 2 | ETag disable (`app.set('etag', false)`) | `app.ts` dòng 37 | ✅ Đúng vị trí, triệt tiêu HTTP 304 |
| 3 | Zod Schema phân hóa (`.extend()`) | `order.schema.ts` dòng 16, `product.schema.ts` dòng 16 | ✅ `adminOrderQuerySchema`, `productQuerySchema` mở rộng từ `paginationQuerySchema` |
| 4 | Phone Regex E.164 (Store Settings) | `store-setting.schema.ts` dòng 8, `user.schema.ts` dòng 8 | ✅ Regex `/^\+?[0-9]{9,15}$/` áp dụng cho cả Store Setting và User |
| 5 | Prisma Required Relation filter fix | Đã xác minh trong Round 9 session | ✅ Loại bỏ `{ is: }` wrapper cho required relations |

### Round 10 — 6/6 Tọa độ + 5 Hotfix ĐÃ XÁC MINH ✅

| # | Task | File kiểm chứng | Kết quả |
|---|------|-----------------|---------|
| 1 | RabbitMQ Prefetch AI Worker = 1 | `ai.worker.ts` dòng 26 | ✅ `const PREFETCH = 1` |
| 2 | VNPay P2002 catch block | `vnpay.controller.ts` dòng 493-501 | ✅ Bắt `P2002` → `{ RspCode: '02' }` |
| 3 | Orphaned Sweeper + Timestamps | `schema.prisma` dòng 141-142, `feedback-sweeper.service.ts`, `app.ts` dòng 187-190 | ✅ `createdAt`/`updatedAt` + distributed lock + `Promise.allSettled` |
| 4 | JWT Fail-Open catch block | `jwt-blacklist.ts` | ✅ Xác minh an toàn, log `console.warn` đầy đủ |
| 5 | Connection pool giữ nguyên | `.env.production` | ✅ `connection_limit=3`, không thay đổi |
| 6 | Upstash quota monitor | Quyết định thiết kế | ✅ Không thêm cache in-memory |
| 7 | CI/CD Rollback thông minh | `deploy-backend.yml` dòng 85, 93-94 | ✅ `id: smoke_test` + `steps.smoke_test.outcome == 'failure'` |
| 8 | `kill_timeout: 10000` cho ai-worker | `ecosystem.config.js` dòng 73 | ✅ Đúng giá trị |
| 9 | Fix `db:push:prod` script (`npx dotenv-cli`) | `package.json` dòng 12 | ✅ `npx -y dotenv-cli -e .env.production -- npx -y prisma db push` |
| 10 | Fix `start:prod` / `worker:email:prod` dùng `node dist/` | `package.json` dòng 9, 19 | ✅ Không còn `ts-node` trong prod scripts |
| 11 | Dời `prisma` + `dotenv-cli` sang `dependencies` | `package.json` dòng 38, 49 | ✅ Có trong `dependencies`, đã xóa khỏi `devDependencies` |
| 12 | PM2 Logrotate cài trên EC2 | Thao tác SSH trực tiếp | ✅ `pm2-logrotate` online, `max_size: 10M`, `retain: 7`, `compress: true` |
| 13 | Fix `forceKillTimer` 5s → 8s | `ai.worker.ts` dòng 229-232 | ✅ `8_000` ms, comment ghi rõ phải < `kill_timeout` |

### Round 11 — 2/2 Tasks Mới & Cấu Hình Đã Bổ Sung ✅

| # | Task | File kiểm chứng | Kết quả |
|---|------|-----------------|---------|
| 1 | AI Worker Idempotency Check trước Gemini call | `ai.worker.ts` dòng 90-93 | ✅ Đã kiểm chứng: kiểm tra `feedback.sentiment !== 'PENDING'` và bỏ qua ngay để chống phí API Gemini. |
| 2 | Bắt buộc truyền `size` và kiểm soát Upload cực kỳ chặt chẽ | `upload.controller.ts` dòng 11-19 | ✅ Đã hoàn thành: Tránh hacker bypass query size, chặn file rác khổng lồ (>5MB) gây tốn phí AWS S3. |

---

## 🎯 NHIỆM VỤ ROUND 11

### Task 4.2 — Khóa Kín Bảo Mật AWS S3 (Cloud Security) 🔴 ƯU TIÊN CAO

**Mục tiêu:** Chặn tuyệt đối mọi truy cập trực tiếp vào S3, ép toàn bộ traffic đọc ảnh đi qua CloudFront CDN.

**Hiện trạng code thực tế:**
- [upload.service.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/upload/upload.service.ts): Presigned URL dùng `PutObjectCommand` với `expiresIn: 300` (5 phút).
- `publicUrl` trả về từ `process.env.CLOUDFRONT_URL` nếu có, hoặc fallback S3 direct URL.
- [storage.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/config/storage.ts): S3Client config cơ bản, chưa có OAC/OAI.

**Checklist thực hiện:**
1. [ ] **S3 Bucket Policy:** Viết JSON policy chặn public access, chỉ cho phép CloudFront OAC/OAI đọc.
2. [ ] **S3 CORS Configuration:** Bổ sung CORS JSON cho bucket, cho phép `PUT` from Frontend origin (CloudFront URL) — **bắt buộc** vì Frontend PUT trực tiếp lên S3 qua Presigned URL.
3. [ ] **CloudFront OAC:** Tạo Origin Access Control trên AWS Console, gắn vào CloudFront Distribution.
4. [ ] **Verify:** Ảnh cũ hiển thị qua CloudFront URL, upload mới vẫn hoạt động.

**Lưu ý quan trọng:** Presigned URL đã chứa AWS Signature nên PUT upload **không bị ảnh hưởng** bởi Bucket Policy chặn public. Tuy nhiên, S3 CORS config cần cho phép `PUT` method từ Frontend domain để trình duyệt không chặn preflight `OPTIONS`.

---

### Task 4.3 — Khóa Lỗ Hổng Bảo Mật Upload (Ứng dụng & Dữ liệu) 🟢 ĐÃ HOÀN THÀNH SỚM (Round 11)

**Mục tiêu:** Khắc phục triệt để lỗ hổng Upload ảnh ở API Presigned URL:
1. Ép buộc truyền tham số `size` từ client (trước đây là tùy chọn, kẻ xấu có thể bỏ qua và upload file 50GB làm tăng vọt chi phí AWS).
2. Kiểm tra định dạng `mimeType` và đuôi file `ext` chặt chẽ qua Allowlist, chặn đứng nguy cơ upload mã độc thực thi lên S3 Origin.

**Kết quả:** Đã hoàn tất sửa đổi trong `upload.controller.ts` bảo vệ an toàn 100% tài khoản AWS.

> [!NOTE]
> ### 💬 Tranh luận Kiến trúc: Tiền xử lý / Resize ảnh & AWS Lambda
> * **1. Ảnh hưởng Deploy:** **HOÀN TOÀN KHÔNG.** Đây là thay đổi thuần túy ở Application Layer (Logic kiểm tra), không thay đổi DB schema, Prisma Client hay cài thêm native package mới, đảm bảo `pm2 reload` zero-downtime trơn tru 100%.
> * **2. Nhu cầu Resize / Nén ảnh:** Cực kỳ cần thiết cho UX và chi phí băng thông CloudFront (Egress). File 5MB là quá nặng cho người dùng di động (ảnh tối ưu nên từ **100KB - 300KB**). Tuy nhiên, do dùng Presigned URL, Backend API **không chạm vào buffer ảnh** (file đi thẳng từ Client lên S3), nên không thể resize bằng `sharp` tại Node.js Backend.
> * **3. Giải pháp AWS Lambda (Event-Driven S3 Processing - Phù hợp Phase 2):** 
>   * *Luồng:* Client -> PUT Raw Image (5MB) lên `s3://bucket/raw/` -> S3 Event trigger AWS Lambda (Node.js/Python + Sharp) chạy ngầm -> Resize & nén thành WebP (150KB) dán watermark -> Lưu vào `s3://bucket/processed/` -> CloudFront CDN phục vụ thư mục processed.
>   * *Đánh giá:* Chuẩn công nghiệp nhưng tốn 1-2 ngày cấu hình hạ tầng IAM, Lambda và Trigger trong lúc dự án đang ở chặng cuối.
> * **4. Giải pháp Pragmatic hiện tại (Nén tại Frontend Angular - ĐÃ HOÀN THÀNH 100%):**
>   * *Giải pháp:* Cài đặt thành công thư viện `browser-image-compression` và tích hợp trực tiếp vào [upload.service.ts](file:///d:/Workspace/Project/e-commerce-project/frontend/src/app/core/services/upload.service.ts) ở Angular.
>   * *Lợi ích:* Mọi ảnh tải lên tự động được nén ngầm (qua Web Worker) xuống dưới 300KB, thu nhỏ khung hình (max 1200px) và tự động chuyển đổi sang định dạng `.webp` siêu nhẹ trước khi gửi lên S3, tối ưu tuyệt đối chi phí AWS Egress & tốc độ load CloudFront. Không làm gãy bất kỳ logic nghiệp vụ nào khác!

---

### Task 7.2 — Stress Test Lua Script Redis (Resilience Testing) 🟡 ƯU TIÊN TRUNG BÌNH

**Mục tiêu:** Viết bộ Unit Test bắn phá hàm `reserveStockOrThrow` chứng minh Lua Script atomic dưới tải đồng thời.

**Hiện trạng code thực tế:**
- [stock-reservation.service.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/inventory/stock-reservation.service.ts): Lua script `RESERVE_LUA` (dòng 43-99) thực hiện check-then-reserve atomic.
- Script đã có cơ chế **idempotency** tích hợp sẵn (dòng 62-65): `if redis.call('EXISTS', holdKey) == 1 then return 1 end`.
- **Chưa có file test** nào trong thư mục `inventory/` — chỉ có mock trong `vnpay.service.test.ts`.

**Checklist thực hiện:**
1. [ ] Tạo `backend/src/modules/inventory/__tests__/stock-reservation.service.test.ts`.
2. [ ] Mock Redis client, test các kịch bản:
   - Reserve thành công (happy path).
   - Reserve khi hết hàng (stock = 0).
   - Reserve trùng `txnRef` (idempotency).
   - Nhiều request reserve đồng thời cùng sản phẩm (race condition simulation).
   - Release stock sau khi reserve.
3. [ ] Chạy `npm test` xác nhận toàn bộ pass.

---

## 🔮 LAYER 8 — OBSERVABILITY (Kế Hoạch Cho Tương Lai - Phase Tiếp Theo)

Một hệ thống tự chữa lành chuẩn Enterprise cần có "đôi mắt" giám sát. Dù chưa được implement trực tiếp trong Round 11 (được tạm gác lại để Go-Live trước), lộ trình xây dựng Khả năng quan sát đã được thống nhất cụ thể:

1. **Centralized Logging (8.1):** Đẩy log PM2/Stdout về **ELK Stack (Elasticsearch, Logstash, Kibana)** hoặc **Loki** để dễ dàng tra cứu log theo transaction ID.
2. **Metrics & Dashboards (8.2):** Tích hợp **Prometheus & Grafana** đo RAM, CPU của Node/EC2, số lượng connections của database Neon Serverless, và số lượng message kẹt trên hàng đợi RabbitMQ.
3. **Application Performance Monitoring - APM (8.3):** Gắn trace ID cho mỗi API request để đo lường chi tiết độ trễ (latency) của luồng qua HTTP -> RabbitMQ -> Gemini AI -> PostgreSQL.

---

## 📋 BẢNG TÓM TẮT ĐỘ ƯU TIÊN ROUND 11

| Task | Mục tiêu | Độ ưu tiên | Loại | Trạng thái |
|------|----------|------------|------|------------|
| **4.2** | Khóa kín S3, ép traffic qua CloudFront | 🔴 **Cao** | Cloud Infra | ⬜ Chưa bắt đầu |
| **4.3** | Khóa bảo mật Upload (Mandatory Size & Allowlist) | 🟢 **Thấp** | Application | ✅ Hoàn thành sớm |
| **7.2** | Stress Test Lua Script Redis | 🟡 **Trung bình** | Testing | ⬜ Chưa bắt đầu |
| **8.x** | Layer 8 - Observability (ELK, Prometheus, Grafana) | 🔵 **Tương lai** | Ops / Infra | 🔲 Chờ thực hiện |
