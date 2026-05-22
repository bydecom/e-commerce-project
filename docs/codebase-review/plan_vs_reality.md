# 🔱 Plan vs Reality — Phản Biện Checklist Với Codebase Thực Tế

> [!NOTE]
> Tài liệu này đối chiếu từng mục trong "Bí Kíp Võ Công" với code thực tế đã quét.
> Mỗi mục có verdict: ✅ Đã xong | ⚠️ Plan đúng nhưng cần điều chỉnh | ❌ Plan sai/thiếu | 🔲 Chưa làm

---

## LAYER 1 — PROCESS & RUNTIME

### 1.1 Graceful Shutdown Handler — ✅ Đã xong

**Plan nói:** Thêm `process.on('SIGTERM')`, gọi `server.close()` rồi `process.exit(0)`. Force kill sau 10s.

**Thực tế:** [index.ts:22-68](file:///d:/Workspace/Project/e-commerce-project/backend/index.ts#L22-L68) — Đã implement đầy đủ:
- `SIGTERM` + `SIGINT` handlers
- `stopCleanupLoop()` → `server.close()` → `prisma.$disconnect()` + `redis.quit()` + `closeRabbitConnection()`
- Force kill timer 10s với `.unref()`
- `kill_timeout: 10000` trong `ecosystem.config.js` khớp

**Bonus so với plan:** Email worker cũng có graceful shutdown riêng ([email.worker.ts:207-231](file:///d:/Workspace/Project/e-commerce-project/backend/src/workers/email.worker.ts#L207-L231)) — plan chỉ đề cập API server.

### 1.2 Unhandled Rejection & Uncaught Exception — ✅ Đã xong

**Plan nói:** Đăng ký `process.on('unhandledRejection')` và `process.on('uncaughtException')`.

**Thực tế:** [index.ts:70-84](file:///d:/Workspace/Project/e-commerce-project/backend/index.ts#L70-L84) — Đúng y plan. Log fatal error rồi gọi `gracefulShutdown()`. Email worker cũng có tương tự.

### 1.3 PM2 Cluster Mode — ✅ Đã xong

**Plan nói:** Bật `instances: 'max'`. Đảm bảo stateless.

**Thực tế:** [ecosystem.config.js:15-16](file:///d:/Workspace/Project/e-commerce-project/backend/ecosystem.config.js#L15-L16) — `instances: 'max'`, `exec_mode: 'cluster'`.

**Bonus so với plan:**
- `wait_ready: true` + `listen_timeout: 5000` + `process.send?.('ready')` cho zero-downtime reload — plan không đề cập cơ chế này.
- Race condition HTTPS + redirect server đã được fix bằng `Promise.all` — plan không cover.

### 1.4 Rate Limit Redis Store — ✅ Đã xong (nhưng plan thiếu 1 điểm)

**Plan nói:** Thay MemoryStore bằng RedisStore. Bonus: chia nhỏ limiter theo endpoint.

**Thực tế:** [app.ts:77-109](file:///d:/Workspace/Project/e-commerce-project/backend/src/app.ts#L77-L109) — RedisStore cho production, fallback MemoryStore cho dev. Đúng.

**⚠️ Plan bonus chưa làm — endpoint-specific limiters:**
- Login: chưa có limiter riêng (dùng chung global 150/15m)
- OTP: chưa có limiter riêng
- AI endpoints: **không có limiter riêng** → đây là rủi ro thật. Mỗi request AI gọi Gemini API tốn tiền. Hacker spam 150 requests/15 phút × 4 endpoints = có thể gây chi phí đáng kể.

**Verdict:** Core done, nhưng endpoint-specific limiters nên là P1 riêng.

### 1.5 Cleanup Loop Distributed Lock — ✅ Đã xong

**Plan nói:** SETNX với TTL ngắn.

**Thực tế:** [stock-reservation.service.ts:324](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/inventory/stock-reservation.service.ts#L324) — `SETNX` + `EX: lockTtlSeconds`. Lock TTL = interval - 1s. Chỉ instance acquire được lock mới chạy cleanup.

**Đúng y plan.**

---

## LAYER 2 — DATABASE & CONNECTION

### 2.1 Connection Pool Limit (Neon) — ✅ Đã xong (Round 8)

**Plan nói:** Thêm `?connection_limit=3` vào `DATABASE_URL`.

**Thực tế:** [.env.production:2](file:///d:/Workspace/Project/e-commerce-project/backend/.env.production#L2) — Đã thêm `connection_limit=3` vào chuỗi kết nối DATABASE_URL trên môi trường Production để khống chế Prisma Client mở tối đa 3 connection cho mỗi instance, đảm bảo an toàn tuyệt đối cho pooler Neon.

### 2.2 Không log HTTP request vào DB chính — 🔲 CHƯA LÀM (Technical Debt)

**Plan nói:** Bỏ `prisma.systemLog.create()`, thay bằng stdout logger.

**Thực tế:** [logger.middleware.ts:18-27](file:///d:/Workspace/Project/e-commerce-project/backend/src/middlewares/logger.middleware.ts#L18-L27) — Vẫn đang INSERT vào DB mỗi request. Có `.catch()` nên không crash, nhưng vẫn tạo 100 INSERT/s khi load cao.

**Ràng buộc thực tế plan không đề cập:** Admin Dashboard có trang System Logs (`/api/system-logs`) kèm chức năng export PDF, đọc trực tiếp từ bảng `SystemLog`. Không thể xóa middleware mà không refactor hoặc cung cấp giải pháp thay thế cho trang admin này.

**Đề xuất thực tế:** Giữ endpoint `/api/system-logs` nhưng chuyển data source. Ngắn hạn: thêm cronjob xóa log cũ > 7 ngày. Dài hạn: publish event qua RabbitMQ, worker ghi batch.

### 2.3 Database Connection qua SSL — ✅ Đã có sẵn

**Plan nói:** Đảm bảo `sslmode=require`.

**Thực tế:** `.env.production` URL đã có `?sslmode=require&channel_binding=require`. **Xong.**

---

## LAYER 3 — MESSAGE QUEUE & ASYNC JOBS

### 3.1 Qdrant Sync → RabbitMQ Worker — 🔲 CHƯA LÀM

**Plan nói:** Thay `await aiService.upsertProductVector()` bằng publish message lên queue.

**Thực tế:** [product.service.ts:468-480](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/product/product.service.ts#L468-L480) — Vẫn đang `await` inline. Nhưng đã có `try/catch` nên nếu Gemini/Qdrant down thì product vẫn save thành công, chỉ vector không sync.

**⚠️ Điều chỉnh plan:** Plan nói "Gemini down → API trả 500 dù product đã lưu". **Thực tế code KHÔNG trả 500** — nó catch lỗi và log warning. Nên priority thực tế thấp hơn plan đề xuất. Vấn đề thật là **latency** (admin chờ thêm 1-2s), không phải correctness.

### 3.2 Feedback AI Analysis → RabbitMQ Worker — 🔲 CHƯA LÀM

**Plan nói:** Thêm `PENDING` enum, tạo feedback trước rồi worker phân tích sau.

**Thực tế:** [feedback.service.ts:191-193](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/feedback/feedback.service.ts#L191-L193) — Đang `await analyzeFeedback()` inline. Nhưng `analyzeFeedbackWithTypes()` bên trong [feedback-analyzer.ts:125-134](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/ai/feedback/feedback-analyzer.ts#L125-L134) có `try/catch` trả về `FALLBACK` (sentiment = NEUTRAL, no plans).

**⚠️ Điều chỉnh plan:** Giống 3.1 — code không crash khi AI down, chỉ mất kết quả phân tích. Priority thực tế thấp hơn. Nhưng Gemini timeout đã được gia cố (15s max qua `withTimeout`), nên user sẽ chờ tối đa 15s thay vì vô hạn.

### 3.3 VNPay IPN — KHÔNG async hóa — ✅ Code đã đúng

**Plan nói:** Giữ logic IPN đồng bộ trong `prisma.$transaction`. Chỉ async email/notification sau khi commit.

**Thực tế:** [vnpay.controller.ts:406-492](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/payment/vnpay.controller.ts#L406-L492) — **Đúng hoàn toàn:**
- `prisma.$transaction` bao bọc toàn bộ logic: check duplicate, verify amount, update payment status, hoàn kho nếu fail
- `RspCode: '00'` chỉ trả **sau khi** transaction commit thành công
- Các side effects (clear cart, release reservation) nằm ngoài transaction với `.catch(() => undefined)`
- Duplicate IPN được handle bằng cả DB check (`paymentTransaction.findUnique`) lẫn Prisma unique constraint (`P2002`)

**Không có gì cần sửa.** Plan mô tả chính xác.

### 3.4 Tách biệt Queue theo loại job — ⚠️ Đã tách 1 phần

**Plan nói:** Mỗi loại job có queue riêng.

**Thực tế:** Hiện có 2 queue riêng biệt: `QUEUE_AUTH` và `QUEUE_ORDER` — cả hai đều do 1 email worker consume. Chưa có queue `qdrant.sync` hay `ai.feedback` vì chưa async hóa (3.1, 3.2).

**Verdict:** Architecture đúng hướng, mở rộng queue khi implement 3.1 + 3.2.

---

## LAYER 4 — STORAGE & CDN

### 4.1 CloudFront CDN cho S3 Images — 🔲 CHƯA LÀM

**Plan nói:** Build `publicUrl` dùng CDN domain thay vì S3 direct.

**Thực tế:** [upload.service.ts:17-19](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/upload/upload.service.ts#L17-L19) — Vẫn trả S3 direct URL:
```typescript
const publicUrl = process.env.AWS_ENDPOINT
  ? `${process.env.AWS_ENDPOINT}/${BUCKET_NAME}/${key}`
  : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
```

**Fix đơn giản:** Thêm env var `CDN_URL`, nếu có thì dùng `${CDN_URL}/${key}`, nếu không thì fallback S3. Khoảng 5 dòng code.

### 4.2 S3 Bucket Policy — 🔲 Cần verify

Không thể kiểm tra từ code. Cần SSH vào EC2 hoặc check AWS Console.

---

## LAYER 5 — CI/CD & DEPLOY

### 5.1 Smoke Test + Auto Rollback — ⚠️ Smoke test có, rollback chưa có

**Plan nói:** Backup dist cũ → deploy mới → health check → rollback nếu fail.

**Thực tế:** [deploy-backend.yml:55-60](file:///d:/Workspace/Project/e-commerce-project/.github/workflows/deploy-backend.yml#L55-L60):
```yaml
- name: 🏥 Smoke Test (Check BE Health)
  run: |
    sleep 15
    curl -f --retry 3 http://${{ secrets.EC2_HOST }}:3000/api/health || exit 1
```

**Có smoke test nhưng không có rollback.** Nếu health check fail → GitHub Actions step fail → **nhưng server production đã chạy code lỗi**. Không có bước backup dist cũ hay restore.

**⚠️ Thêm 1 vấn đề plan chưa đề cập:** CI ban đầu dùng `pm2 restart` thay vì `pm2 reload`. Chúng ta đã refactor thành công sang `pm2 reload` để thực hiện rolling restart = zero-downtime chuẩn chỉ.

### 5.2 Hardcoded values → env var — ✅ Đã xong (Round 8)

**Plan nói:** CORS, IP EC2, CloudFront URL → env var.

**Thực tế:**
- CORS: Đã chuyển đổi hoàn chỉnh [app.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/app.ts) sang đọc động `process.env.CLIENT_URL` với cơ chế tự động strip trailing slash (`.trim().replace(/\/$/, '')`) để loại bỏ rủi ro block CORS do gõ nhầm dấu gạch chéo cuối.
- IP EC2: IP của EC2 được cấu hình động thông qua environment variable `CLIENT_URL` và `API_BASE_URL` trong `.env.production`.
- VNPay return URL: Đọc động từ `process.env.VNP_RETURN_URL` cấu hình chuẩn trong `.env.production`.

---

## LAYER 6 — SECURITY

### 6.1 RabbitMQ Credentials & Port — ✅ Đã xong (Round 8)

**Plan nói:** Đổi password mạnh, không expose port ra internet.

**Thực tế:**
- [docker-compose.prod.yml](file:///d:/Workspace/Project/e-commerce-project/docker-compose.prod.yml) đã xóa bỏ hoàn toàn cụm block `ports: "5672:5672"` để chặn kết nối RabbitMQ từ public internet (chỉ cho phép localhost gọi nội bộ).
- Cấu hình credentials của RabbitMQ đã được đổi từ tĩnh sang đọc biến môi trường `${RABBITMQ_USER}` và `${RABBITMQ_PASS}` từ `.env.production`.
- Cấu hình mật khẩu RabbitMQ cực kỳ phức tạp đã được định nghĩa trong `.env.production` local trên EC2, và `RABBITMQ_URL` đã được cập nhật đồng bộ tương ứng.

> [!NOTE]
> `.env.production` chứa toàn bộ credentials thật (DB password, Redis URL, JWT secret, VNPay hash secret, Gemini API key, AWS keys, Mail password). File này hiện chỉ tồn tại local và **không bị Git track** (đáp ứng đúng chuẩn an toàn). Phát hiện ban đầu nghi ngờ bị commit là false alarm, đã được verify chắc chắn bằng `git ls-files` và `git show --stat`.

### 6.2 Không dùng `$queryRawUnsafe` — ✅ An toàn

**Plan nói:** Review tất cả chỗ dùng raw query.

**Thực tế:** Grep `$queryRawUnsafe` → **0 kết quả**. Tất cả raw query đều dùng `$queryRaw` tagged template (Prisma tự escape). [product.service.ts:248](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/product/product.service.ts#L248) — user input (`search`, `qUnaccent`) được truyền qua template literal interpolation `${search}`, Prisma tự parameterize.

**Không có SQL injection risk.**

---

## LAYER 7 — TESTING

### 7.1 VNPay Signature Verification Test — 🔲 CHƯA CÓ

**Plan nói:** Unit test cho `verifyVnpayReturn()`.

**Thực tế:** Không có file test nào cho payment module. Hàm `verifyVnpayReturn` có ~100 dòng logic với 3 phương pháp verify signature song song — **không có test nào cover**. Đây là rủi ro cao nhất trong codebase.

### 7.2 Stock Reservation Race Condition Test — 🔲 CHƯA CÓ

**Plan nói:** Test concurrent checkout.

**Thực tế:** Không có concurrent test. Logic reservation dùng Lua script trên Redis (atomic) nên **về mặt lý thuyết** không bị race condition, nhưng chưa có test chứng minh.

---

## LAYER 8 — OBSERVABILITY

### 8.1-8.3 — 🔲 Chưa implement (Plan đúng — đây là learn concepts, implement khi cần)

---

## 📊 Bảng Tổng Hợp Cập Nhật

| # | Task | Status | Plan chính xác? | Ghi chú điều chỉnh |
|---|------|--------|-----------------|---------------------|
| 1.1 | Graceful shutdown | ✅ Done | ✅ Đúng | Bonus: email worker cũng có |
| 1.2 | Unhandled rejection | ✅ Done | ✅ Đúng | |
| 1.3 | PM2 Cluster Mode | ✅ Done | ⚠️ Thiếu | Plan không đề cập `wait_ready` + `process.send('ready')` |
| 1.4 | Rate Limit Redis | ✅ Done | ⚠️ Thiếu | Chưa có endpoint-specific limiters (AI, login, OTP) |
| 1.5 | Distributed Lock | ✅ Done | ✅ Đúng | |
| 2.1 | Connection Pool | 🔲 | ✅ Đúng | **Fix ngay: 1 dòng env var.** Đang dùng pooler endpoint nên chưa sập |
| 2.2 | Bỏ DB Logger | 🔲 | ⚠️ Thiếu | Plan không đề cập ràng buộc Admin Dashboard |
| 2.3 | SSL connection | ✅ Done | ✅ Đúng | Đã có `sslmode=require` |
| 3.1 | Qdrant → MQ worker | 🔲 | ⚠️ Exaggerate | Code không crash khi AI down — chỉ tốn latency |
| 3.2 | Feedback → MQ worker | 🔲 | ⚠️ Exaggerate | Tương tự 3.1 — đã có fallback |
| 3.3 | VNPay IPN sync | ✅ Đúng | ✅ Đúng | Code match plan 100% |
| 3.4 | Queue tách biệt | ⚠️ Partial | ✅ Đúng | Có 2 queue, mở rộng khi cần |
| 4.1 | CDN cho S3 | 🔲 | ✅ Đúng | ~5 dòng code + AWS config |
| 4.2 | S3 Bucket Policy | 🔲 | ✅ Đúng | Cần check AWS Console |
| 5.1 | Auto Rollback | ⚠️ Partial | ⚠️ Thiếu | Có smoke test, đã sửa CI sang `pm2 reload` zero-downtime |
| 5.2 | Env vars | 🔲 | ✅ Đúng | CORS + VNP_RETURN_URL hardcoded |
| 6.1 | RabbitMQ security | 🔲 | ✅ Đúng | Password yếu + port exposed |
| 6.2 | SQL injection | ✅ Safe | ✅ Đúng | Không có `$queryRawUnsafe` |
| 7.1 | VNPay test | 🔲 | ✅ Đúng | **Rủi ro cao nhất — tiền thật** |
| 7.2 | Race condition test | 🔲 | ✅ Đúng | Lua atomic nhưng chưa có proof |

---

## 🚨 Phát Hiện Mới (Plan Không Đề Cập)

### A. `.env.production` không bị track bởi Git (An toàn)
Nghi vấn ban đầu về việc file này bị push lên repository là false alarm. Đã kiểm tra và xác nhận file `.env.production` chỉ tồn tại local, Git history chỉ chứa `.env.example`. Do đó, credentials hoàn toàn an toàn.

### B. CI dùng `pm2 restart` thay vì `pm2 reload` (Đã sửa đổi thành công)
[deploy-backend.yml:52](file:///d:/Workspace/Project/e-commerce-project/.github/workflows/deploy-backend.yml#L52) ban đầu dùng `restart` gây downtime ngắn. Đã được refactor sang `pm2 reload` để phối hợp nhịp nhàng với tín hiệu `ready` của Cluster Mode, đem lại khả năng Zero-Downtime deploy thật sự.

### C. AI endpoints không có rate limiter riêng
Mỗi request AI = 1 Gemini API call = chi phí thực. Global limiter 150/15m là quá rộng cho endpoint tốn tiền.

### D. Hybrid Fail-Open/Closed cho JWT Blacklist
Đã implement (Round 5) — plan không đề cập. Token > 5m remaining → Fail-Closed. Token < 5m → Fail-Open. Cân bằng availability vs security.

### E. Gemini API không có timeout
Đã fix (Round 5) — thêm `withTimeout` 15s. Plan không đề cập nhưng quan trọng vì external API call treo = request treo.

### F. Độc lập múi giờ VNPay (Timezone Safety)
Đã rà soát chi tiết cơ chế sinh `vnp_CreateDate` gửi sang VNPay. Hàm `formatVnpDateGmt7` lấy UNIX time (không đổi theo múi giờ server), dịch chuyển +7 giờ, rồi format bằng các hàm UTC. Nhờ vậy, chuỗi thời gian gửi đi luôn là GMT+7 chính xác tuyệt đối, triệt tiêu hoàn toàn rủi ro sai múi giờ (lùi 7 tiếng) khi chạy trên AWS EC2 cấu hình UTC.

---

## 📋 Thứ Tự Ưu Tiên Điều Chỉnh

| # | Task | Effort | Lý do ưu tiên |
|---|------|--------|---------------|
| 1 | ~~Graceful shutdown~~  | ~~Done~~ | ✅ |
| 2 | ~~**Credentials ra khỏi Git**~~ | ~~1-2 giờ~~ | ✅ An toàn (Không bị Git track - False alarm) |
| 3 | ~~**RabbitMQ password + port**~~ | ~~30 phút~~ | ✅ Done (Round 8) |
| 4 | ~~**Connection limit Neon**~~ | ~~5 phút~~ | ✅ Done (Round 8) |
| 5 | ~~**CI: `restart` → `reload`**~~ | ~~5 phút~~ | ✅ Done (Đã nâng cấp sang reload zero-downtime) |
| 6 | **VNPay unit test** | 1.5-2 ngày | 🔴 Tiền thật, không có test |
| 7 | **AI endpoint rate limiter** | 2 giờ | 🟡 Chống spam tốn tiền Gemini |
| 8 | CI auto rollback | 0.5 ngày | 🟡 |
| 9 | ~~**CORS + env vars**~~ | ~~30 phút~~ | ✅ Done (Round 8) |
| 10 | CDN cho S3 images | 1 ngày | 🟢 |
| 11 | Qdrant/Feedback → MQ worker | 2 ngày | 🟢 Latency, không phải correctness |
| 12 | DB Logger refactor | 1 ngày | 🟢 Technical debt, cần plan cho Admin Dashboard |
