# 🔱 Master Checklist: Bản Đồ Bám Sát Tiến Độ Go-Live (R1 → R11)

Tài liệu này tổng hợp toàn bộ các nhiệm vụ, cải tiến kiến trúc, và sửa lỗi bảo mật/hiệu năng đã thực hiện từ **Round 1** đến **Round 11**. Bản đồ này được đúc kết từ [technical_critique.md](file:///d:/Workspace/Project/e-commerce-project/docs/codebase-review/technical_critique.md) và [plan_vs_reality.md](file:///d:/Workspace/Project/e-commerce-project/docs/codebase-review/plan_vs_reality.md) để bạn dễ dàng theo dõi và đối chiếu trước khi bàn giao dự án.

---

## 📊 TỔNG QUAN TIẾN ĐỘ CHUNG

| Tầng Phân Tích (Layers) | Tổng Số Task | Đã Hoàn Thành (Done) | Chờ Console/Backlog | Tỉ lệ Hoàn Thành |
|---|---|---|---|---|
| **Layer 1 — Process & Runtime** | 5 | 5 | 0 | 100% ✅ |
| **Layer 2 — Database & Connection** | 3 | 3 | 0 | 100% ✅ |
| **Layer 3 — Async Queue & Workers** | 6 | 6 | 0 | 100% ✅ |
| **Layer 4 — Storage & Cloud CDN** | 3 | 3 | 0 | 100% ✅ |
| **Layer 5 — CI/CD & Deploy Pipelines** | 4 | 4 | 0 | 100% ✅ |
| **Layer 6 — Security & DevOps** | 6 | 6 | 0 | 100% ✅ |
| **Layer 7 — Testing & Verification** | 3 | 3 | 0 | 100% ✅ |
| **Layer 8 — Observability (Backlog)** | 3 | 0 | 3 (Phase Tiếp Theo) | 0% 🔲 |
| **UX & Kiến Trúc Phát Sinh (Bonus)** | 6 | 6 | 0 | 100% ✅ |
| **TỔNG CỘNG** | **39** | **36** | **3** | **92.3%** 🚀 |

---

## 🛠️ CHI TIẾT CHECKLIST THEO TỪNG PHÂN LỚP

### 1. 🏎️ LAYER 1 — PROCESS & RUNTIME (Tầng Ứng Dụng)
*Mục tiêu: Đảm bảo tiến độ ứng dụng chạy mượt mà, stateless, chịu tải cao và không bị crash rò rỉ tài nguyên.*

- [x] **SIGTERM & SIGINT Graceful Shutdown:** 
  - *Chi tiết:* Gọi `stopCleanupLoop()`, `server.close()`, giải phóng kết nối Prisma, Redis, và RabbitMQ mượt mà.
  - *File kiểm chứng:* [backend/index.ts:22-68](file:///d:/Workspace/Project/e-commerce-project/backend/index.ts#L22-L68) & [email.worker.ts:207-231](file:///d:/Workspace/Project/e-commerce-project/backend/src/workers/email.worker.ts#L207-L231)
- [x] **Unhandled Rejection & Uncaught Exception Handlers:** 
  - *Chi tiết:* Bắt trọn mọi ngoại lệ bất ngờ, in log và thực thi tắt app an toàn thay vì để app rơi vào trạng thái zombie hỏng dữ liệu.
  - *File kiểm chứng:* [backend/index.ts:70-84](file:///d:/Workspace/Project/e-commerce-project/backend/index.ts#L70-L84)
- [x] **PM2 Cluster Mode & Zero-Downtime Reload:** 
  - *Chi tiết:* Bật `instances: 'max'`, `exec_mode: 'cluster'`. Kết hợp `wait_ready: true`, nâng `listen_timeout: 8000` (chống cold start Neon) và bắn tín hiệu `process.send?.('ready')` để PM2 reload tuần tự không gây downtime.
  - *File kiểm chứng:* [backend/ecosystem.config.js:15-16](file:///d:/Workspace/Project/e-commerce-project/backend/ecosystem.config.js#L15-L16)
- [x] **Rate Limit Phân Hóa & Redis Store Fallback:** 
  - *Chi tiết:* Tích hợp RedisStore thay thế MemoryStore. Tạo `authRateLimiter` (max 20 reqs/15m) bảo vệ Auth API và `aiRateLimiter` siêu chặt (max 10 reqs/15m) chống spam ví Gemini API. Tự động **fallback về MemoryStore cục bộ** nếu Redis sập.
  - *File kiểm chứng:* [backend/src/app.ts:77-109](file:///d:/Workspace/Project/e-commerce-project/backend/src/app.ts#L77-L109)
- [x] **Cleanup Loop Distributed Lock:** 
  - *Chi tiết:* Sử dụng lệnh `SETNX` với TTL (lockTtlSeconds) để chỉ cho phép duy nhất một instance PM2 thực thi vòng lặp dọn dẹp các giao dịch giữ kho ảo hết hạn, ngăn chặn triệt để SQL Query duplicate và CPU spikes.
  - *File kiểm chứng:* [stock-reservation.service.ts:324](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/inventory/stock-reservation.service.ts#L324)

---

### 2. 🗄️ LAYER 2 — DATABASE & CONNECTION (Neon PostgreSQL)
*Mục tiêu: Bảo vệ giới hạn kết nối của Database Serverless Neon và tối ưu hóa số lượng IOPS.*

- [x] **Neon Connection Pool Limit:** 
  - *Chi tiết:* Chặn đứng nguy cơ cạn kiệt pooler bằng cách khống chế tham số `&connection_limit=3` trong chuỗi kết nối Database URL.
  - *File kiểm chứng:* [backend/.env.production:2](file:///d:/Workspace/Project/e-commerce-project/backend/.env.production#L2)
- [x] **Gỡ Bỏ DB System Logger (Stdout Stream):** 
  - *Chi tiết:* Loại bỏ hoàn toàn module Prisma `systemLog` khỏi HTTP middleware. Toàn bộ log API được đẩy ra `stdout` ở dạng JSON để PM2 lưu trữ. Trang Dashboard Admin tạm ẩn liên kết này để bảo đảm tính nhất quán dữ liệu.
  - *File kiểm chứng:* [logger.middleware.ts:14-29](file:///d:/Workspace/Project/e-commerce-project/backend/src/middlewares/logger.middleware.ts#L14-L29)
- [x] **Database Connection qua SSL:** 
  - *Chi tiết:* Bảo mật dữ liệu truyền tải với `sslmode=require&channel_binding=require` trong chuỗi env URL.
  - *File kiểm chứng:* [backend/.env.production](file:///d:/Workspace/Project/e-commerce-project/backend/.env.production)

---

### 3. 🐇 LAYER 3 — ASYNC QUEUE & WORKERS (RabbitMQ & Workers)
*Mục tiêu: Đưa các tác vụ nặng, tốn thời gian xử lý ra khỏi luồng HTTP chính để tăng latency phản hồi API lên gấp 200 lần (<10ms).*

- [x] **Bất Đồng Bộ Qdrant Vector Sync:** 
  - *Chi tiết:* Chuyển luồng gọi Gemini API sinh embeddings và upsert Qdrant Cloud sang RabbitMQ (`q.ai.tasks`). Khi Admin lưu sản phẩm, API phản hồi lập tức. Worker chạy ngầm tự xử lý (có tích hợp thêm thông tin giá sản phẩm để tìm kiếm ngữ nghĩa chính xác).
  - *File kiểm chứng:* [product.service.ts:468-480](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/product/product.service.ts#L468-L480)
- [x] **Phân Tích Cảm Xúc Feedback Ngầm:** 
  - *Chi tiết:* Bổ sung trạng thái `PENDING` vào model Feedback. Khi khách hàng feedback, BE lưu DB và trả về 200 lập tức. Worker (`ai.worker.ts`) tiêu thụ job, gọi Gemini AI phân loại sentiment và tự động tạo `FeedbackActionPlan` trong 1 single transaction.
  - *File kiểm chứng:* [feedback.service.ts:191-193](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/feedback/feedback.service.ts#L191-L193)
- [x] **VNPay IPN processed check (Giữ Đồng Bộ An Toàn):** 
  - *Chi tiết:* Luồng VNPay IPN được giữ chạy đồng bộ trong `prisma.$transaction` để bảo vệ dòng tiền thật. Side-effects gửi mail hay release kho được tách ra ngoài với `.catch()`. 
  - *File kiểm chứng:* [vnpay.controller.ts:406-492](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/payment/vnpay.controller.ts#L406-L492)
- [x] **Tách Biệt Queue Theo Loại Job & Dead Letter Queue (DLQ):** 
  - *Chi tiết:* Thiết lập các hàng đợi cách ly chuyên nghiệp: `q.auth.tasks` (email đăng ký), `q.order.tasks` (email đơn hàng), `q.ai.tasks` (xử lý vector & feedback). Cấu hình DLQ (`ex.dlq`) để chứa các message lỗi. **Cải tiến:** Đã vá lỗ hổng "Thùng rác không đổ" (Silent Mute) bằng cách áp dụng TTL 7 ngày và Max Length 500 cho mọi DLQ tránh tràn ổ đĩa EC2.
  - *File kiểm chứng:* [ai.worker.ts:157-165](file:///d:/Workspace/Project/e-commerce-project/backend/src/workers/ai.worker.ts#L157-L165)
- [x] **Orphaned Feedback Sweeper (Tọa độ 1):** 
  - *Chi tiết:* Viết `feedback-sweeper.service.ts` định kỳ quét feedback kẹt ở trạng thái `PENDING` quá 30 phút bằng SQL Raw. Sử dụng Redis distributed lock (`feedback:sweeper:lock`) chống race condition và republish thông minh qua `Promise.allSettled`.
  - *File kiểm chứng:* [feedback-sweeper.service.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/feedback/feedback-sweeper.service.ts)
- [x] **RabbitMQ Prefetch Tuning & Gemini API Timeout:** 
  - *Chi tiết:* Hạ prefetch từ 2 xuống 1 cho `ai.worker.ts` chặn rate limit của Gemini API. Đồng thời bổ sung `withTimeout` 15s cho Gemini API bảo vệ worker không bị treo vô thời hạn.
  - *File kiểm chứng:* [ai.worker.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/workers/ai.worker.ts)
---

### 4. ☁️ LAYER 4 — STORAGE & CLOUD CDN (AWS S3 & CloudFront)
*Mục tiêu: Chống bypass bảo mật của file tĩnh, tăng tốc độ phân phối ảnh và bảo vệ túi tiền đám mây.*

- [x] **CloudFront CDN cho S3 Images:** 
  - *Chi tiết:* Đã tích hợp biến môi trường `CLOUDFRONT_URL` để toàn bộ link ảnh sản phẩm trả về client đều đi qua CloudFront Edge thay vì trực tiếp vào S3 Bucket gốc.
  - *File kiểm chứng:* [upload.service.ts:17-21](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/upload/upload.service.ts#L17-L21)
- [x] **Khóa Lỗ Hổng Bảo Mật Upload (Task 4.3):** 
  - *Chi tiết:* Ép buộc truyền tham số `size`, kiểm định `<= 5MB` ở Backend, kết hợp Allowlist cứng phần mở rộng (`['jpg', 'jpeg', 'png', 'webp', 'gif']`). **Ngoài ra:** Tích hợp `browser-image-compression` tại Frontend nén ảnh ngầm qua Web Worker thành `.webp` siêu nhẹ <300KB trước khi upload lên S3.
  - *File kiểm chứng:* [upload.controller.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/upload/upload.controller.ts) & [upload.service.ts (Frontend)](file:///d:/Workspace/Project/e-commerce-project/frontend/src/app/core/services/upload.service.ts)
- [x] **AWS S3 Bucket Policy & CORS (Task 4.2):** 
  - *Chi tiết:* Chặn tuyệt đối mọi truy cập trực tiếp vào S3 bucket, chỉ cho phép CloudFront OAC đi qua.
  - *Trạng thái:* ✅ **Đã hoàn thành** (Cấu hình thành công OAC cho GET và CORS cho Presigned PUT).

---

### 5. 🚀 LAYER 5 — CI/CD & DEPLOY PIPELINES (GitHub Actions)
*Mục tiêu: Đưa tự động hóa vào vận hành, kiểm thử tự động và tự động phục hồi khi deploy bị lỗi.*

- [x] **Smart Auto-Rollback Pipeline (Task 5.1):** 
  - *Chi tiết:* Thiết lập bước tự động backup thư mục `dist` cũ trước khi đẩy code mới. Tự động kích hoạt Smoke Test kiểm tra sức khỏe qua `/api/health`. Nếu Smoke test fail sau 3 lần retry, pipeline tự động rollback khôi phục lại `dist.backup` và gọi `pm2 reload`.
  - *File kiểm chứng:* [deploy-backend.yml:32-113](file:///d:/Workspace/Project/e-commerce-project/.github/workflows/deploy-backend.yml#L32-L113)
- [x] **Dynamic Environment Configuration:** 
  - *Chi tiết:* Loại bỏ hoàn toàn các địa chỉ IP và Domain cứng. Đọc động `CLIENT_URL` trong CORS setup với hàm strip trailing slash tự động (`.trim().replace(/\/$/, '')`).
  - *File kiểm chứng:* [app.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/app.ts)
- [x] **Frontend S3 Sync & CloudFront Invalidation Pipeline:** 
  - *Chi tiết:* Pipeline tự động build Angular, sync đè tài nguyên tĩnh lên AWS S3 và tự động phát lệnh `cloudfront create-invalidation` xóa cache cũ trên các CDN Edge, hoàn tất bằng smoke test qua edge URL.
  - *File kiểm chứng:* [deploy-frontend.yml](file:///d:/Workspace/Project/e-commerce-project/.github/workflows/deploy-frontend.yml)
- [x] **GitHub Actions Automated Test CI:** 
  - *Chi tiết:* Chạy tự động toàn bộ Jest test suite trên môi trường CI khi có lượt push hoặc Pull Request, tự động nén gói báo cáo độ phủ `coverage-report` thành artifact.
  - *File kiểm chứng:* [test.yml](file:///d:/Workspace/Project/e-commerce-project/.github/workflows/test.yml)

---

### 6. 🔒 LAYER 6 — SECURITY & DEVOPS (Hạ Tầng)
*Mục tiêu: Đóng kín các lỗ hổng hệ thống và bảo vệ thông tin nhạy cảm của khách hàng.*

- [x] **RabbitMQ Security Hardening:** 
  - *Chi tiết:* Xóa block `ports` của RabbitMQ trong docker-compose prod để chặn đứng truy cập từ public internet. Đọc động credentials từ `${RABBITMQ_USER}`/`${RABBITMQ_PASS}` trong file `.env.production` local bảo mật tuyệt đối.
  - *File kiểm chứng:* [docker-compose.prod.yml](file:///d:/Workspace/Project/e-commerce-project/docker-compose.prod.yml)
- [x] **Triệt Tiêu Nguy Cơ SQL Injection:** 
  - *Chi tiết:* Rà soát và loại bỏ hoàn toàn các lệnh Prisma `$queryRawUnsafe`. Tất cả các truy vấn thô đều dùng Parameterized Tagged Templates (`$queryRaw`) giúp tự động escape ký tự nguy hại.
  - *File kiểm chứng:* [product.service.ts:248](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/product/product.service.ts#L248)
- [x] **JWT Blacklist Hybrid Fail-Open/Closed (Task 2.4):** 
  - *Chi tiết:* Cân bằng giữa bảo mật và tính sẵn sàng khi Redis sập ngắn hạn: Token có thời gian sống còn lại > 5 phút được áp dụng cơ chế Fail-Closed (an sau); Token có thời gian sống < 5 phút áp dụng Fail-Open để đảm bảo người dùng bình thường không bị đá văng khỏi phiên làm việc.
  - *File kiểm chứng:* [jwt-blacklist.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/auth/jwt-blacklist.ts)
- [x] **PM2 IPv4 DNS Resolution Order Fix:** 
  - *Chi tiết:* Bổ sung tham số `node_args: '--dns-result-order=ipv4first'` cho toàn bộ các tiến trình API và Workers trong PM2 để ngăn chặn lỗi nghẽn DNS 5-10s (do cơ chế ưu tiên IPv6 mặc định của Node 17+ kết hợp với hạ tầng Linux EC2).
  - *File kiểm chứng:* [ecosystem.config.js](file:///d:/Workspace/Project/e-commerce-project/backend/ecosystem.config.js)
- [x] **PM2 Logrotate Integration:** 
  - *Chi tiết:* Cấu hình và kích hoạt thành công mô-đun logrotate nội bộ (`max_size: 10M`, `retain: 7`, `compress: true`) trên EC2 production để dọn dẹp các tệp log phình to, tháo ngòi nổ "đầy ổ đĩa" gây sập database và RabbitMQ.
- [x] **Bảo Mật Credentials Khỏi Git:** 
  - *Chi tiết:* Đã kiểm tra và đảm bảo `.env.production` chứa thông tin nhạy cảm thật chỉ tồn tại local trên máy chủ và được bỏ qua an toàn bởi Git (nằm trong `.gitignore`).

---

### 7. 🧪 LAYER 7 — TESTING & VERIFICATION (Kiểm Chứng)
*Mục tiêu: Đảm bảo các logic nghiệp vụ quan trọng được bao phủ bởi các bài test chuẩn chỉ.*

- [x] **VNPay Return & IPN Webhook Integration Tests:** 
  - *Chi tiết:* Thiết lập bộ test suite chuyên sâu 25 cases bao phủ logic tính success, chữ ký decoded/raw_encoded, và các phản hồi IPN chuẩn (RspCode 97, 01, 04, 02).
  - *File kiểm chứng:* [vnpay.service.test.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/payment/__tests__/vnpay.service.test.ts)
- [x] **Stock Reservation Lua Script & Error Swallowing Tests (Task 7.2):** 
  - *Chi tiết:* Hoàn thành 19/19 test cases phủ kín logic Atomicity của Lua script giữ kho, cơ chế chống trùng lắp (Idempotency), timeout giữ kho, và kiểm định việc nuốt lỗi (error swallowing) an toàn.
  - *File kiểm chứng:* [stock-reservation.service.test.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/inventory/__tests__/stock-reservation.service.test.ts)
- [x] **Vá Lỗi Best-Effort Redis Swallowing:** 
  - *Chi tiết:* Bọc toàn bộ kết nối và các câu lệnh Redis của hàm `attachReservationOrderIdBestEffort` vào khối try-catch để ngăn chặn việc lỗi hạ tầng Redis làm gián đoạn luồng checkout mua hàng chính của người dùng.
  - *File kiểm chứng:* [stock-reservation.service.ts:238-253](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/inventory/stock-reservation.service.ts#L238-L253)

---

### 8. 🔮 LAYER 8 — OBSERVABILITY (Khả Năng Quan Sát - Phase Sau)
*Mục tiêu: Cung cấp "đôi mắt" giám sát hệ thống ở quy mô Enterprise (Được quy hoạch chi tiết và chờ thực hiện).*

- [ ] **8.1 Centralized Logging:** Thiết lập Loki hoặc ELK Stack để tập trung hóa PM2 logs và truy vết theo transaction ID.
- [ ] **8.2 Metrics & Grafana Dashboards:** Đo lường CPU/RAM EC2, pool size Neon, và queue length của RabbitMQ.
- [ ] **8.3 Application Performance Monitoring (APM):** Đo lường latency từng phân lớp (HTTP -> Queue -> Gemini -> Postgres).

---

### 🌟 9. UX & KIẾN TRÚC PHÁT SINH (BONUS - Đã Hoàn Thành)
*Mục tiêu: Mài giũa các chi tiết UX tinh tế và sửa các lỗi kỹ thuật phát sinh không có trong plan gốc.*

- [x] **VNPay GMT+7 Timezone Safety:** 
  - *Chi tiết:* Sửa hàm `formatVnpDateGmt7` dịch chuyển múi giờ cục bộ +7 giờ trước khi định dạng chuỗi, bảo đảm tham số gửi sang VNPay luôn chuẩn xác bất kể máy chủ EC2 chạy theo giờ UTC.
- [x] **Auth Cookie Cross-Domain Setup:** 
  - *Chi tiết:* Chuyển đổi cookie `refresh_token` từ `sameSite: 'strict'` sang `sameSite: 'none'` kèm `secure: true` để trình duyệt không block phiên làm việc giữa Frontend (CloudFront) và API (EC2).
  - *File kiểm chứng:* [auth.controller.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/auth/auth.controller.ts)
- [x] **UX Đếm Ngược Đăng Ký & Định Dạng Tiền VND:** 
  - *Chi tiết:* Bổ sung màn hình đếm ngược 3 giây tự động chuyển hướng về Login khi xác thực email thành công ở Angular. Chuẩn hóa toàn bộ currency về VND.
  - *File kiểm chứng:* `EmailVerifiedComponent` & Frontend codebase.
- [x] **Vá Lỗi Zod Data Stripping (Query Params):** 
  - *Chi tiết:* Khắc phục lỗi Zod tự động lọc bỏ (strip) các tham số tìm kiếm/lọc (`search`, `status`) do dùng chung schema phân trang cơ bản. Đã mở rộng `.extend()` rành mạch.
  - *File kiểm chứng:* [order.schema.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/order/order.schema.ts) & [product.schema.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/product/product.schema.ts)
- [x] **Kiểm Định Định Dạng Hotline E.164:** 
  - *Chi tiết:* Đồng bộ hóa Regex `/^\+?[0-9]{9,15}$/` cho Hotline Store Settings ở cả Backend Zod Schema và Angular Reactive Form, hiển thị trực quan thông báo lỗi màu đỏ khi sai định dạng.
- [x] **Vá Bẫy PM2 Env Injection (Workers độc lập):** 
  - *Chi tiết:* Sửa lỗi các Workers chạy ngầm PM2 bị mất cấu hình do `dotenv` chỉ đọc file `.env` mặc định. Đã khai báo nạp động `dotenv.config({ path: '.env.production' })` ngay dòng đầu tiên ở cả 2 Workers.
  - *File kiểm chứng:* [ai.worker.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/workers/ai.worker.ts) & [email.worker.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/workers/email.worker.ts)

---

> [!NOTE]
> Checklist này được lưu trữ tại [master_checklist.md](file:///d:/Workspace/Project/e-commerce-project/docs/codebase-review/master_checklist.md) trong repository dự án để bạn có thể cập nhật trạng thái bất kỳ lúc nào, phục vụ cho đợt bàn giao cuối cùng.
