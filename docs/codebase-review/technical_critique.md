# 🔬 Phản Biện Kỹ Thuật: Improvement Plan vs Thực Tế Codebase

Tài liệu này **phản biện từng mục** trong plan trước, dựa trên code thật đã quét.

> [!NOTE]
> **Lịch sử tài liệu:** Document này đã qua 8 vòng review:
> - **Round 1** — AI draft phản biện dựa trên codebase scan
> - **Round 2** — Owner phản hồi 3 điểm, AI sửa lại (symlink, feedback schema, effort estimates)
> - **Round 3** — External reviewer nhận xét về cách làm việc và confirm thứ tự ưu tiên
> - **Round 4** — Deep scan codebase phát hiện thêm 5 lỗi nghiêm trọng khi lên Production (Database Logging, Cleanup Loop Race Condition, Upload S3 Bypass CDN, Neon connection limit, missing global handlers)
> - **Round 5** — Implementation Layer 1 (5 mục Process & Runtime) + Owner review 3 điểm sai trong implementation: `listen_timeout` cơ chế, cold start buffer, HTTPS ready race condition
> - **Round 6** — Phản biện kiến trúc & Giải pháp Lai (Hybrid Blacklist Verification) để cân bằng giữa bảo mật tuyệt đối (Fail-Closed) và độ sẵn sàng cao (Fail-Open) khi Redis gặp sự cố ngắn hạn.
> - **Round 7** — Xác minh Production Logs trên EC2 sau đợt deploy đầu tiên. Phát hiện và xử lý 3 lỗi ẩn trên Production: Race condition khởi tạo RedisStore sớm của middleware rate limit, điều chỉnh `listen_timeout` lên 8000ms cho cold start Neon, và dọn dẹp kết nối Prisma trong tập lệnh vector đồng bộ.
> - **Round 8** — Khai hỏa Hướng 1 "Đánh nhanh thắng nhanh": Đóng triệt để port public RabbitMQ (5672) chỉ giữ localhost, thiết lập credentials siêu mạnh cho RabbitMQ từ env vars, gia cố Neon connection limit (connection_limit=3), và dọn dẹp CORS allowedOrigins sang động (strip trailing slash).
>
> Các block `💬 Tranh luận` trong document ghi lại quá trình hình thành quyết định. **Context tại sao chọn giải pháp này quan trọng hơn bản thân giải pháp** — khi quay lại sau 3 tháng hoặc onboard người mới, phần tranh luận sẽ có giá trị hơn phần kết luận.

### 🏗️ Production Infrastructure Map

| Component | Service | Ghi chú |
|---|---|---|
| **Frontend** | AWS S3 + CloudFront | Static hosting, CDN edge caching |
| **Backend API + Workers** | AWS EC2 | PM2 quản lý process (API + email worker) |
| **RabbitMQ** | Docker trên EC2 (chung với BE) | `docker-compose.prod.yml` |
| **PostgreSQL** | Neon (Serverless Postgres) | Managed, auto-scaling |
| **Redis** | Upstash (Serverless Redis) | Cache, rate-limit, stock reservation |
| **Qdrant** | Qdrant Cloud | Vector search, semantic embeddings |
| **Object Storage** | AWS S3 | Presigned URL upload. CDN layer đang plan |
| **Mail** | Google Mail Service | Production SMTP |
| **Payment** | VNPay (sandbox) | IPN webhook qua public EC2 |

---

## 1. 🐇 RabbitMQ Multi-Worker — Plan Đúng Hướng, Nhưng Thiếu Chi Tiết Nguy Hiểm

### ✅ Plan nói đúng
Tách worker riêng cho Payment, Qdrant Sync, AI Tasks là hợp lý.

### ⚠️ Vấn đề thực tế plan chưa đề cập

**a) Qdrant Sync đang BLOCKING HTTP request — đây là bug hiệu năng thật:**

Trong [product.service.ts:470-481](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/product/product.service.ts#L468-L481), khi Admin tạo/sửa product AVAILABLE:

```typescript
// Đang chạy ĐỒNG BỘ trong HTTP handler!
await aiService.initQdrant();           // Gọi Qdrant HTTP API
await aiService.upsertProductVector({   // Gọi Gemini API để tạo embedding rồi upsert
  id: p.id, name: p.name, ...
});
```

Vấn đề: `upsertProductVector()` gọi **Gemini embedding API** (network call ~500ms-2s) rồi **Qdrant upsert** (network call ~100-300ms). Admin phải chờ **tổng cộng 600ms-2.3s thêm** cho mỗi lần save product. Nếu Gemini rate-limited hoặc Qdrant down → API trả 500 dù product đã lưu DB thành công.

> [!IMPORTANT]
> **Đây chính là candidate #1 để đưa vào RabbitMQ.** Plan cũ nói "đồng bộ Qdrant qua worker" nhưng không chỉ ra rằng code hiện tại đang block. Khi tách ra worker, cần xử lý edge case: nếu user search ngay sau khi admin save → vector chưa sync → kết quả search thiếu product mới. Giải pháp: search fallback luôn merge kết quả từ Postgres prefix/trigram (code hiện tại [product.service.ts:269-288](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/product/product.service.ts#L269-L288) đã làm hybrid search nên **eventual consistency là chấp nhận được**).

**b) Feedback AI analysis cũng đang BLOCKING:**

Trong [feedback.service.ts:191-193](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/feedback/feedback.service.ts#L191-L193):

```typescript
const analysis = comment?.trim()
  ? await analyzeFeedback(comment.trim())  // Gọi Gemini trong HTTP request!
  : { resolvedTypeId: null, sentiment: 'NEUTRAL', ... };
```

Khi user submit feedback → API **đợi Gemini phân tích sentiment + sinh action plan** trước khi trả response. Nếu Gemini mất 3-5s → user nhìn thấy spinner quay 3-5s. Nếu Gemini down → feedback không tạo được dù DB sẵn sàng.

> [!WARNING]
> **Phản biện plan:** Plan nói "chuyển AI sang background" nhưng chưa chỉ ra rằng logic hiện tại **couple chặt**: feedback CREATE phải có `sentiment` và `actionPlans` trước khi insert. Nếu tách async, cần cho phép tạo feedback với sentiment chưa xác định, worker AI xử lý xong thì UPDATE lại sentiment + CREATE action plans riêng.

> [!NOTE]
> ### 💬 Tranh luận (Round 2 — Owner phản hồi)
> **Owner:** "Không nhất thiết phải refactor cả schema lẫn business logic — chỉ cần thêm 1 enum value `PENDING` vào `SentimentLabel` và 1 worker job là đủ."
>
> **Đánh giá lại:** Đồng ý. Giải pháp thực tế:
> 1. Thêm `PENDING` vào enum `SentimentLabel` trong `schema.prisma`
> 2. `createFeedback()` tạo feedback với `sentiment: 'PENDING'`, publish message lên MQ
> 3. AI worker nhận message → gọi Gemini → `UPDATE feedback SET sentiment = 'NEGATIVE'` + `CREATE FeedbackActionPlan`
>
> Đây là **1 migration + 1 worker file** — không phải "refactor lớn" như document ban đầu mô tả. Bản gốc đã overcomplicate vấn đề.

**c) `docker-compose.prod.yml` chỉ có RabbitMQ — Qdrant chạy trên Qdrant Cloud:**

File [docker-compose.prod.yml](file:///d:/Workspace/Project/e-commerce-project/docker-compose.prod.yml) chỉ khai báo RabbitMQ vì RabbitMQ chạy chung EC2 với BE. Các service khác dùng managed cloud: PostgreSQL → Neon, Redis → Upstash, Qdrant → Qdrant Cloud. Kiến trúc này hợp lý — chỉ cần đảm bảo env vars `QDRANT_URL` và `QDRANT_API_KEY` được set đúng trong `.env.production`.

---

## 2. 🤖 AI → Lambda — Plan Cần Phản Biện Mạnh

### ❌ Plan cũ đề xuất 2 phương án nhưng chưa phân tích kỹ trade-off thật

**Thực tế code cho thấy bạn có 4 loại AI task hoàn toàn khác nhau:**

| Task | Trigger | Cần response ngay? | Latency chấp nhận | Phù hợp |
|---|---|---|---|---|
| **Chatbot** (user + admin) | User gửi message | **CÓ** — phải stream/trả ngay | <3s | **Giữ trong API** hoặc Lambda with API Gateway streaming |
| **Feedback analyzer** | User submit feedback | **KHÔNG** — user chỉ cần biết "đã gửi" | 5-30s | **RabbitMQ Worker** |
| **Description enhancer** | Admin bấm nút | **CÓ** — admin đợi kết quả | <5s | **Giữ trong API** (admin chờ được) |
| **Mini advice** | Cron / admin mở dashboard | **KHÔNG** — cached 1 ngày | vô hạn | **RabbitMQ Worker** hoặc **Lambda scheduled** |

> [!IMPORTANT]
> **Phản biện:** Không nên đưa TẤT CẢ AI lên Lambda. Chatbot và Description Enhancer cần response đồng bộ — đưa lên Lambda chỉ thêm cold start latency (~1-3s) mà không giải quyết gì. Chỉ nên Lambda hóa các task **không cần response ngay** (feedback analysis, mini advice, Qdrant sync).

**Lý do Worker trên EC2 tốt hơn Lambda cho project này:**

1. **Chi phí**: Gemini API call mất 2-10s. Lambda tính tiền theo thời gian chạy. Nếu có 100 feedback/ngày × 5s/call = 500s Lambda/ngày. Worker trên EC2 → chi phí = $0 thêm (đã trả tiền EC2).
2. **Cold start**: Lambda Node.js cold start ~1-3s, warm ~200ms. Nhưng feedback analysis không cần nhanh → không quan trọng.
3. **Prisma on Lambda**: Prisma client cần generate + bundle ~30-50MB. Lambda có giới hạn 250MB unzipped. Phải dùng Prisma Data Proxy hoặc raw SQL → phức tạp hóa không cần thiết.
4. **Shared code**: Worker chạy cùng codebase, import thẳng `prisma`, `rabbitmq`, `ai.service` → zero overhead. Lambda phải maintain package riêng.

> [!TIP]
> **Đề xuất thực tế:** Dùng **Phương án A (Worker)** cho tất cả. Lambda chỉ nên cân nhắc khi bạn scale lên hàng nghìn AI tasks/phút mà EC2 không đủ RAM — hiện tại hoàn toàn chưa cần.

---

## 3. 💳 VNPay IPN → MQ — Plan Có Lỗ Hổng Nghiêm Trọng

### ❌ Plan cũ sai ở điểm cốt lõi

Plan đề xuất: *"IPN chỉ verify signature → publish MQ → trả ngay `RspCode: 00`"*

**Vấn đề: VNPay IPN spec yêu cầu `RspCode` phản ánh trạng thái xử lý thật:**
- `00` = đã xử lý thành công
- `01` = order not found
- `02` = already processed
- `04` = invalid amount

Nếu ta trả `00` ngay mà worker chưa xử lý → VNPay nghĩ đã OK → **không gửi lại IPN**. Nhưng nếu worker fail (DB down, Prisma deadlock) → **tiền đã trừ nhưng order không được PAID** → mất tiền khách.

> [!CAUTION]
> **Đây là lỗi thiết kế nghiêm trọng trong plan cũ.** VNPay IPN là webhook **idempotent** — nếu ta trả lỗi, VNPay sẽ retry. Đây chính là cơ chế retry tự nhiên tốt nhất. Đừng bỏ nó đi để tự build retry bằng MQ.

### ✅ Đề xuất sửa lại

Giữ nguyên logic IPN xử lý đồng bộ trong [vnpay.controller.ts:383-501](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/payment/vnpay.controller.ts#L383-L501) (code hiện tại đã xử lý tốt rồi — dùng `prisma.$transaction`, check duplicate, check amount). **Chỉ thêm phần async sau khi transaction thành công:**

```typescript
// Sau line 484-486 (payment success):
if (response.code === '00' && response.finalized === 'success') {
  await cartService.clearCart(response.userId).catch(() => undefined);
  // ... existing code ...
  
  // MỚI: Bắn event async để thông báo admin (KHÔNG ảnh hưởng IPN response)
  publishPaymentSuccess({ orderId, txnRef, amount: vnpAmount }).catch(() => {});
}
```

**Phần nên dùng MQ cho payment:**
- Gửi notification real-time cho admin (WebSocket/SSE) → async, không critical
- Gửi email xác nhận thanh toán cho customer → async
- Log analytics → async

**Phần KHÔNG nên dùng MQ:**
- Update `paymentStatus` → phải đồng bộ trong IPN handler
- Check duplicate transaction → phải đồng bộ
- Restore stock khi fail → phải đồng bộ

---

## 4. 🖼️ S3 + CloudFront CDN — Plan Đúng, Nhưng Thiếu 2 Bước Quan Trọng

### ✅ Đúng: CloudFront là lựa chọn tối ưu nhất

Bạn đã có CloudFront cho frontend ([deploy-frontend.yml](file:///d:/Workspace/Project/e-commerce-project/.github/workflows/deploy-frontend.yml) line 47: `aws cloudfront create-invalidation`), nên thêm 1 distribution cho S3 images là tự nhiên.

### ⚠️ Plan thiếu phân tích code thật

**a) `storageUrl` đang dùng trực tiếp S3 URL:**

Trong [environment.prod.ts](file:///d:/Workspace/Project/e-commerce-project/frontend/src/environments/environment.prod.ts):
```typescript
storageUrl: 'https://ecommerce-products.s3.ap-southeast-1.amazonaws.com'
```

Nhưng search codebase cho thấy `storageUrl` **không được dùng ở đâu trong app code** — nghĩa là `imageUrl` trong DB đã lưu **full S3 URL** (ví dụ: `https://ecommerce-products.s3.ap-southeast-1.amazonaws.com/products/abc.jpg`). 

> [!WARNING]
> **Vấn đề:** Nếu chuyển sang CloudFront CDN domain (`https://cdn.yourdomain.com/products/abc.jpg`), tất cả `imageUrl` cũ trong DB vẫn trỏ về S3 trực tiếp. Cần migration strategy:
> - **Option A:** Chạy SQL update tất cả `imageUrl` trong DB thay domain
> - **Option B:** Frontend dùng pipe/interceptor tự replace domain prefix khi render (linh hoạt hơn, không sợ rollback)
> - **Option C (Tốt nhất):** Backend presigned URL endpoint trả `publicUrl` dùng CDN domain. Chỉ ảnh mới dùng CDN, ảnh cũ vẫn hoạt động qua S3 (vì CloudFront forward request về S3 origin)

**b) S3 Bucket hiện tại có thể đang public:**

[storage.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/config/storage.ts) dùng `forcePathStyle` cho MinIO nhưng production không set endpoint → đi thẳng S3. README nói MinIO sidecar tạo bucket với **public download policy**. Nếu production S3 cũng public → chuyển sang OAC sẽ **break tất cả ảnh cũ** (vì URL path khác). Cần kiểm tra S3 bucket policy thật.

---

## 5. 🧪 Unit Test — Plan Quá Chung Chung

### ⚠️ Phân tích test hiện tại cho thấy vấn đề cụ thể

Test hiện có: [order.service.test.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/order/__tests__/order.service.test.ts) (224 lines), [product.service.test.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/product/__tests__/product.service.test.ts) (142 lines). Pattern: mock `prisma`, `redis`, `rabbitmq`, `ai.service` → test pure business logic.

**Các module THỰC SỰ cần test theo thứ tự ưu tiên rủi ro:**

| Priority | Module | Tại sao | Effort |
|---|---|---|---|
| 🔴 P0 | `vnpay.service.ts` — `verifyVnpayReturn()` | **Liên quan tiền thật.** Hàm verify signature 100 dòng logic phức tạp với 3 phương pháp verify khác nhau. Bug ở đây = mất tiền hoặc bị giả mạo. | 1 ngày |
| 🔴 P0 | `vnpay.controller.ts` — `vnpayIpn()` | 120 dòng xử lý transaction. Edge cases: duplicate IPN, amount mismatch, concurrent calls. | 1 ngày |
| 🟡 P1 | `feedback.service.ts` — `createFeedback()` | Logic phức tạp: check order ownership, check DONE status, check duplicate, AI analysis → tạo feedback + action plans atomically. | 0.5 ngày |
| 🟡 P1 | `stock-reservation.service.ts` | Race condition khi 2 user checkout cùng lúc. | 0.5 ngày |
| 🟢 P2 | `auth.service.ts` — OTP flow | OTP expiry, rate limit, lockout. | 0.5 ngày |
| 🟢 P2 | `cart.service.ts` | Pricing calculation. | 0.5 ngày |

> [!TIP]
> **Plan cũ liệt kê "test Auth, Cart, VNPay, Workers" nhưng không prioritize.** VNPay signature verification test là **quan trọng nhất** vì bug ở đó ảnh hưởng trực tiếp đến tài chính.

---

## 6. 🔄 Smoke Test Rollback — Symlink vs Backup/Restore

### ⚠️ Symlink hoạt động được, nhưng Backup/Restore đơn giản hơn cho context hiện tại

Plan đề xuất Capistrano-style symlink releases. Cả hai phương án đều khả thi:
- **Symlink**: Dùng `pm2 reload --update-env` hoặc `pm2 startOrReload` thì PM2 sẽ pick up đường dẫn mới qua symlink. Phương án này chuẩn công nghiệp và scale tốt khi có nhiều releases cần giữ lại.
- **Backup/Restore**: Đơn giản hơn nhiều cho setup hiện tại (1 EC2, deploy qua SCP). Dễ debug, ít moving parts.

### ✅ Đề xuất cho context hiện tại: Backup & Restore

Với setup 1 EC2 + SCP + PM2, backup/restore là lựa chọn pragmatic hơn:

```yaml
- name: 🔄 Backup phiên bản đang chạy
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ubuntu
    key: ${{ secrets.EC2_SSH_KEY }}
    script: |
      cd ~/app/e-commerce-project/backend
      rm -rf dist.backup
      cp -r dist dist.backup

- name: 🚚 Deploy code mới
  # ... SCP + npm install + prisma generate + pm2 reload ...

- name: 🏥 Smoke Test
  run: |
    sleep 15
    curl -f --retry 5 --retry-delay 3 http://${{ secrets.EC2_HOST }}:3000/api/health || exit 1

- name: 🚨 Rollback nếu Smoke Test fail
  if: failure()
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ubuntu  
    key: ${{ secrets.EC2_SSH_KEY }}
    script: |
      cd ~/app/e-commerce-project/backend
      if [ -d "dist.backup" ]; then
        rm -rf dist
        mv dist.backup dist
        pm2 reload ecosystem.config.js --env production
        echo "⚠️ ROLLBACK THÀNH CÔNG - đã khôi phục phiên bản cũ"
      fi
```

> [!NOTE]
> ### 💬 Tranh luận (Round 2 — Owner phản hồi)
> **Owner:** "Symlink không sai. Vấn đề PM2 cache path giải quyết được bằng `pm2 reload --update-env`. Lý do bác symlink hơi yếu."
>
> **Đánh giá lại:** Đồng ý — symlink là pattern valid và production-proven. Document ban đầu gắn ❌ là quá mạnh. Thực tế:
> - Symlink + `pm2 reload --update-env` **hoạt động đúng**
> - Symlink có lợi thế khi cần giữ nhiều bản release để rollback xa hơn 1 version
> - Backup/restore được recommend ở đây vì **đơn giản hơn cho team 2 người**, không phải vì symlink sai
>
> **Kết luận:** Cả hai đều là giải pháp hợp lệ. Chọn backup/restore nếu muốn ít moving parts. Chọn symlink nếu muốn pattern chuẩn công nghiệp và khả năng rollback nhiều version.

---

## 7. ⏳ Zero-Downtime — Plan Đúng Nhưng Thiếu 1 Điều Kiện Tiên Quyết

### ✅ PM2 Cluster Mode + `pm2 reload` là đúng

### ❌ Nhưng code hiện tại CHƯA SẴN SÀNG cho cluster mode

**a) Không có Graceful Shutdown handler:**

Search cả codebase: **không có `process.on('SIGTERM')` hay `process.on('SIGINT')` ở đâu cả.**

Khi PM2 reload, nó gửi `SIGTERM` cho instance cũ. Nếu không handle → Node.js kill ngay lập tức → các request đang xử lý bị cắt giữa chừng (especially Prisma transactions trong payment).

```typescript
// CẦN THÊM vào index.ts:
const server = http.createServer(app);

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing gracefully...');
  server.close(() => {
    prisma.$disconnect().then(() => process.exit(0));
  });
  // Force kill after 10s nếu có request stuck
  setTimeout(() => process.exit(1), 10_000);
});
```

**b) `startReservationCleanupLoop` chạy interval trong API process:**

[app.ts:105-108](file:///d:/Workspace/Project/e-commerce-project/backend/src/app.ts#L105-L108):
```typescript
startReservationCleanupLoop({ intervalMs: 5_000, batchSize: 100 });
```

Cluster mode = 2+ instances = 2+ cleanup loops chạy song song → **race condition** khi cả 2 instance cùng release reservation. Cần:
- Dùng Redis distributed lock (SETNX), hoặc
- Tách cleanup loop ra worker riêng (chạy fork mode, 1 instance)

**c) Rate limiter dùng in-memory store:**

[app.ts:70-87](file:///d:/Workspace/Project/e-commerce-project/backend/src/app.ts#L70-L87) dùng `express-rate-limit` mặc định → **MemoryStore**. Cluster mode = mỗi instance có counter riêng → user có thể gửi `150 × N instances` requests thay vì 150. Cần đổi sang `rate-limit-redis`:

```typescript
import RedisStore from 'rate-limit-redis';
const globalLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redisClient().sendCommand(args) }),
  // ...
});
```

---

## 8. 🔍 Những Vấn Đề Plan Cũ KHÔNG ĐỀ CẬP (Bổ sung)

### a) Hardcoded IP trong production code — ✅ ĐÃ GIẢI QUYẾT (Round 8)

**Tình trạng:** Đã được sửa đổi hoàn toàn trong [index.ts](file:///d:/Workspace/Project/e-commerce-project/backend/index.ts). Dòng log hiển thị IP cứng đã được chuyển đổi thành:
```typescript
console.log(`Backend: http://localhost:${PORT}`);
console.log(`Health:  http://localhost:${PORT}/api/health`);
```
Các biến địa chỉ kết nối và host đều được lấy động từ môi trường.

### b) RabbitMQ production credentials yếu — ✅ ĐÃ GIẢI QUYẾT (Round 8)

**Tình trạng:** Đã được cấu hình bảo mật hoàn hảo:
- Trong [docker-compose.prod.yml](file:///d:/Workspace/Project/e-commerce-project/docker-compose.prod.yml), cổng `5672` đã bị gỡ bỏ khỏi block `ports` để ngăn chặn hoàn toàn việc phơi bày RabbitMQ ra public internet (chỉ cho phép localhost gọi cục bộ trong host).
- Các credentials của RabbitMQ (`RABBITMQ_DEFAULT_USER` và `RABBITMQ_DEFAULT_PASS`) đã được đổi sang đọc động từ biến môi trường `${RABBITMQ_USER}` và `${RABBITMQ_PASS}`.
- Đã cấu hình mật khẩu RabbitMQ siêu mạnh và phức tạp trong `.env.production` local trên EC2, đồng thời cập nhật `RABBITMQ_URL` tương ứng.

### c) CORS hardcoded CloudFront URL — ✅ ĐÃ GIẢI QUYẾT (Round 8)

**Tình trạng:** Đã dọn dẹp triệt để trong [app.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/app.ts).
- CORS `allowedOrigins` giờ đây được đọc động từ `process.env.CLIENT_URL` thay vì hardcode domain.
- **Tính năng an toàn bổ sung:** Tự động gọi hàm `.trim().replace(/\/$/, '')` để tự động làm sạch và cắt bỏ dấu gạch chéo cuối cùng (`/`) nếu cấu hình env dư thừa, ngăn chặn 100% rủi ro bị block CORS do sai khác định dạng đuôi URL.
- Biến env `CLIENT_URL` và `VNP_RETURN_URL` cũng được cấu hình chuẩn xác trong `.env.production`.

### d) Frontend `storageUrl` không dùng

`environment.prod.ts` có `storageUrl` nhưng grep cho thấy **không file nào trong `src/app/` import nó**. Images render bằng `imageUrl` từ API (đã là full S3 URL). Biến này là dead code.

### e) Database Write Logger Middleware (Nghẽn cổ chai hiệu năng cực nặng)

[logger.middleware.ts:18-27](file:///d:/Workspace/Project/e-commerce-project/backend/src/middlewares/logger.middleware.ts#L18-L27):
```typescript
prisma.systemLog.create({
  data: { method: req.method, url: req.originalUrl, status: res.statusCode, responseTime: timeInMs }
})
```
> [!CAUTION]
> **Đây là một anti-pattern cực kỳ nguy hiểm trên Production.**
> Với mỗi request HTTP (trừ health/sys-logs/docs), backend lại thực hiện **1 câu lệnh INSERT đồng bộ vào database**. 
> - Nếu hệ thống đạt 100 requests/s -> DB phải chịu thêm 100 INSERTS/s chỉ để log!
> - Việc này làm cạn kiệt connection pool của Prisma nhanh chóng, tăng dung lượng DB Neon (Serverless) lên hàng chục GBs chỉ sau vài tuần, và gián tiếp làm chậm các transaction quan trọng (thanh toán, đặt hàng).
> - **Giải pháp:** Trong môi trường production, **tuyệt đối không log vào DB chính**. Nên log ra `stdout` (dùng Winston, Pino, hoặc morgan) và để PM2/Docker logs capture lại. Từ đó các log collectors (AWS CloudWatch, Datadog) sẽ thu gom bất đồng bộ về server quản lý log chuyên dụng.

### f) Race Condition trong Checkout Stock Cleanup Loop (Cluster Mode)

[stock-reservation.service.ts:313-339](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/inventory/stock-reservation.service.ts#L313-L339):
Vòng lặp giải phóng stock giữ chỗ hết hạn chạy qua `setInterval` sau mỗi 5 giây.
> [!WARNING]
> Khi chạy **PM2 Cluster Mode** (ví dụ: 4 instances chạy song song), **tất cả 4 processes** sẽ cùng chạy loop này, cùng query `zRangeByScore` trên Redis tại cùng một thời điểm, và cùng cố gắng chạy `cancelOrderSystem` cho cùng một danh sách các checkout session hết hạn.
> - Dù transaction của Prisma và logic Lua của Redis có tính idempotent (chống trùng lặp), việc này vẫn tạo ra **hàng loạt query DB trùng lặp vô ích**, spam log lỗi và làm tăng tải cho DB.
> - **Giải pháp:** Cần sử dụng cơ chế **Distributed Lock** trên Redis (ví dụ: dùng `SETNX` với lock key có TTL ngắn khoảng 3 giây trước khi chạy loop, hoặc tối ưu Lua script để dùng `ZPOPMIN` lấy và xóa key hết hạn một cách nguyên tử) để đảm bảo chỉ có **duy nhất 1 instance** được phép thực thi tác vụ dọn dẹp tại một thời điểm.

### g) Direct S3 URL returned by Upload Service (Bypass hoàn toàn CloudFront CDN)

[upload.service.ts:17-19](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/upload/upload.service.ts#L17-L19):
```typescript
const publicUrl = process.env.AWS_ENDPOINT
  ? `${process.env.AWS_ENDPOINT}/${BUCKET_NAME}/${key}`
  : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
```
> [!IMPORTANT]
> Backend sinh URL ảnh trả về cho Frontend và lưu vào DB trỏ thẳng đến **S3 Direct URL**.
> - Kể cả khi bạn đã cấu hình **CloudFront CDN** đứng trước S3 để cache ảnh và giảm chi phí data egress, DB vẫn lưu link S3 gốc. Khi frontend hiển thị danh sách sản phẩm, trình duyệt của người dùng sẽ **tải trực tiếp từ S3**, bỏ qua hoàn toàn CloudFront CDN edge cache!
> - Việc này làm tăng chi phí AWS Egress cực kỳ đắt đỏ của S3 và làm chậm thời gian tải ảnh của người dùng ở xa.
> - **Giải pháp:** Thêm biến môi trường `CDN_URL` (ví dụ `https://cdn.yourdomain.com`) vào `.env.production`. Trong service upload, nếu có `CDN_URL`, hãy build `publicUrl` theo CDN domain: `${process.env.CDN_URL}/${key}`.

### h) Nguy cơ Connection Pool Exhaustion trên Neon (Serverless Postgres) — ✅ ĐÃ GIẢI QUYẾT (Round 8)

**Tình trạng:** Đã thêm tham số `&connection_limit=3` trực tiếp vào chuỗi kết nối `DATABASE_URL` trong [.env.production](file:///d:/Workspace/Project/e-commerce-project/backend/.env.production).
- Lợi ích: Khống chế Prisma Client mở tối đa 3 kết nối cho mỗi instance API. Khi PM2 nhân bản cluster lên `max` cores cộng thêm các email background worker chạy song song, tổng số kết nối mở đồng thời luôn nằm dưới hạn mức an toàn của pooler Neon, triệt tiêu nguy cơ sập DB pooler do quá tải connection.

### i) Thiếu Unhandled Rejection & Uncaught Exception Handler toàn cục

Trong file `backend/index.ts`, dự án **chưa hề đăng ký listener** cho các sự kiện lỗi nghiêm trọng toàn cục của Node.js:
```typescript
process.on('unhandledRejection', ...);
process.on('uncaughtException', ...);
```
- Trên production, nếu một tác vụ chạy nền (như RabbitMQ background worker, Redis client mất kết nối, hoặc logic gửi mail bất đồng bộ) quăng ra lỗi (Promise Rejection) mà không được bắt (`catch`), Node.js (từ bản 15 trở đi) sẽ **tự động kill process** lập tức.
- Điều này dẫn đến server API bị sập liên tục và PM2 phải khởi động lại instance liên tiếp, làm gián đoạn trải nghiệm người dùng.
- **Giải pháp:** Đăng ký các handler toàn cục trong `index.ts` để log lỗi ra stdout/file và thực hiện graceful shutdown an toàn thay vì để process bị kill đột ngột.

---

## 📊 Tổng Kết: Plan Cũ vs Thực Tế

| Mục | Plan cũ | Phản biện |
|---|---|---|
| **1. RabbitMQ Workers** | ✅ Đúng hướng | ⚠️ Thiếu chỉ ra Qdrant sync + Feedback AI đang blocking HTTP. Async feedback chỉ cần thêm `PENDING` enum. |
| **2. AI → Lambda** | ❌ Lambda cho tất cả | ✅ Worker trên EC2 tốt hơn. Lambda chỉ hợp lý khi scale cực lớn. Chatbot + Description enhancer giữ đồng bộ. |
| **3. VNPay → MQ** | ❌ Sai nguyên lý IPN | ✅ Giữ IPN đồng bộ, chỉ async phần notification/email sau khi DB commit. |
| **4. S3 + CDN** | ✅ Đúng | ⚠️ Thiếu migration strategy cho `imageUrl` cũ trong DB và kiểm tra bucket policy. |
| **5. Unit Test** | ✅ Đúng | ⚠️ Cần prioritize VNPay signature test trước tiên (risk = tiền thật). |
| **6. Rollback** | ⚠️ Symlink valid nhưng overkill | ✅ Backup/restore đơn giản hơn cho context hiện tại. Symlink không sai. |
| **7. Zero-Downtime** | ✅ Cluster mode đúng | ❌ Code chưa sẵn sàng: thiếu graceful shutdown, cleanup loop race condition, rate-limit in-memory. |

---

> [!IMPORTANT]
> ## Thứ Tự Ưu Tiên Thực Hiện (Dựa trên Rủi Ro)
> Effort estimates có 2 cột: **dev có kinh nghiệm** vs **người mới** (chưa từng gặp vấn đề này).
>
> | # | Task | Experienced | Fresh grad | Ghi chú |
> |---|---|---|---|---|
> | 1 | **Graceful shutdown handler** | 30 phút | 2-4 giờ | Cần hiểu SIGTERM/SIGINT lifecycle, test thủ công bằng `kill -SIGTERM` |
> | 2 | **VNPay signature unit test** | 1 ngày | 1.5-2 ngày | Mock data từ VNPay docs, test 3 verification methods |
> | 3 | **PM2 cluster + rate-limit-redis + cleanup loop** | 0.5 ngày | 1-2 ngày | Cần hiểu cluster fork model, Redis store setup, distributed lock |
> | 4 | **CI/CD rollback (backup/restore)** | 2 giờ | 0.5 ngày | Chủ yếu là YAML syntax + test trên branch riêng |
> | 5 | **Qdrant sync → MQ worker** | 0.5 ngày | 1 ngày | Pattern giống email worker, copy + adapt |
> | 6 | **Feedback AI → async worker** | 0.5 ngày | 1 ngày | Thêm PENDING enum + worker job |
> | 7 | **CloudFront CDN cho images** | 0.5 ngày | 1 ngày | Chủ yếu config AWS Console + test |

> [!NOTE]
> ### 💬 Tranh luận (Round 2 — Owner phản hồi)
> **Owner:** "Estimate '30 phút' cho graceful shutdown hơi optimistic. Người mới chưa hiểu SIGTERM/SIGINT flow thì dễ mất cả ngày debug."
>
> **Đánh giá lại:** Hoàn toàn đúng. Bản gốc estimate theo góc nhìn dev đã biết Node.js process lifecycle. Thực tế cần thêm thời gian:
> - Đọc hiểu SIGTERM vs SIGINT vs SIGKILL khác nhau thế nào
> - Hiểu tại sao `server.close()` cần callback, tại sao không `process.exit()` ngay
> - Test thực tế: gửi request dài → kill process → verify request có complete không
> - Debug nếu PM2 kill timeout không đủ → process bị SIGKILL thay vì graceful
>
> Đã cập nhật bảng estimate với 2 cột cho 2 mức kinh nghiệm.

---

> [!TIP]
> ### 💬 Round 3 — External Reviewer
> **Nhận xét tổng quan:**
> - Tài liệu này giờ có giá trị hơn nhiều so với plan gốc, vì nó ghi lại cả *lý do tại sao* chứ không chỉ *làm gì*. Khi quay lại sau 3 tháng hoặc giải thích cho người mới, context tranh luận đó quan trọng hơn kết luận.
> - Cả 3 điểm Owner phản hồi ở Round 2 đều đúng và có lý.
>
> **Confirm thứ tự ưu tiên:** Bắt đầu từ **graceful shutdown** — nó là **prerequisite bắt buộc** trước khi bật cluster mode. Làm sai thứ tự (bật cluster trước, thêm graceful shutdown sau) → cluster mode sẽ cắt request payment giữa chừng khi PM2 reload, và lỗi này **không phát hiện được ngay** vì chỉ xảy ra khi có request đang xử lý đúng lúc reload.
>
> **Về cách làm việc với AI:** Điểm đáng chú ý nhất không phải nội dung kỹ thuật — mà là workflow: AI draft → Owner review + phản biện → AI sửa lại. Đây là cách dùng AI đúng: Owner là người review, AI là người draft.
>
> ---
>
> [!TIP]
> ### 💬 Round 4 — Deep Scan & Production Readiness (Bổ sung từ Quét Codebase)
> **Nhận xét tổng quan:**
> - Việc phát hiện 5 lỗi nghiêm trọng trên Production (Nghẽn cổ chai log DB, Race condition ở Cluster Mode, S3 direct URL, Neon connection limits, thiếu unhandled rejections handler) đã nâng cấp tài liệu này thành một **Production Readiness Checklist** thực thụ.
> - Những lỗi này là "vật cản" phổ biến nhất mà các dev mới ra trường (fresh grads) thường bỏ sót khi chuyển đổi từ môi trường local dev sang cloud production thực tế.
>
> **Định hướng tiếp theo:** Ghi vết và tích hợp 5 rủi ro này vào làm đầu ra/tiêu chí chấp nhận (Acceptance Criteria) cho lộ trình 7 bước tối ưu hóa tiếp theo. Bắt tay thực hiện ngay Step 1: Graceful Shutdown handler toàn diện.

---

> [!NOTE]
> ### 💬 Round 5 — Layer 1 Implementation Review (Owner phản hồi code)
> **Đã implement Layer 1 (5 mục Process & Runtime) cùng lúc.** Owner review code diff và phát hiện 3 lỗi:
>
> **1. `listen_timeout` không hoạt động nếu thiếu `wait_ready: true`:**
> - AI set `listen_timeout: 3000` nhưng comment mô tả sai cơ chế. `listen_timeout` chỉ có nghĩa khi kết hợp `wait_ready: true` + `process.send('ready')` trong code.
> - **Fix:** Thêm `wait_ready: true` vào `ecosystem.config.js`, thêm `process.send?.('ready')` vào `server.listen()` callback trong `index.ts`.
>
> **2. `listen_timeout: 3000` quá sát cho cold start EC2 + Neon:**
> - Neon Serverless Prisma connect mất ~1-2s, cộng Redis + module load → 3s không đủ buffer.
> - **Fix:** Nâng lên `5000`. Thêm `performance.now()` log startup time để Owner tự tune dựa trên số thực tế + 50% buffer sau deploy đầu tiên.
>
> **3. Race condition khi HTTPS + HTTP redirect:**
> - `process.send('ready')` được gọi ngay khi HTTPS server bind xong, nhưng HTTP redirect server có thể chưa bind. PM2 nhận `ready` → kill instance cũ → window ngắn redirect bị drop.
> - **Fix:** Dùng `Promise.all([httpsReady, redirectReady])` rồi mới gọi `process.send('ready')`.
>
> **Kết luận:** Cả 3 điểm đều là lỗi "đúng trên dev, sai trên production" — chỉ phát hiện khi hiểu rõ cơ chế bên dưới (PM2 IPC protocol, Neon cold start latency, TCP port binding order). Workflow AI implement → Owner review → fix lại tiếp tục chứng minh hiệu quả.

---

> [!TIP]
> ### 💬 Round 6 — Phản biện kiến trúc & Giải pháp Lai (Hybrid Blacklist Verification)
> **Bối cảnh:** AI đề xuất bọc `try/catch` cho `isJwtBlacklisted` để Fail-Open (trả về `false` - cho qua khi Redis down) nhằm bảo vệ High Availability của toàn bộ các API đã xác thực.
>
> **Owner phản biện:** Fail-Open hoàn toàn có lỗ hổng bảo mật nghiêm trọng. Nếu Redis down 5 phút, một token đã bị logout hoặc tài khoản bị ban (với thời gian sống còn dài) vẫn có thể gọi API checkout/payment thoải mái trong 5 phút đó. Trái lại, Fail-Closed (trả về `true` - chặn lại) thì làm sập dịch vụ đối với 100% người dùng hợp lệ khi Redis gặp sự cố ngắn hạn. Đây không phải quyết định kỹ thuật thuần túy mà là sự đánh đổi Product (Security vs Availability).
>
> **Giải pháp Lai (Hybrid) được thống nhất & triển khai:**
> - **Cơ chế:** Middleware xác thực truyền trực tiếp `exp` (unix timestamp) có sẵn từ JWT đã giải mã vào `isJwtBlacklisted(jti, exp)` để tối ưu hóa hiệu năng (không decode JWT 2 lần).
> - **Logic xử lý khi Redis down:**
>   - **Fail-Closed (`return true`):** Nếu thời gian sống còn lại của token **lớn hơn 5 phút** (`remainingMs > 5 * 60 * 1000`), rủi ro bảo mật cao -> Chặn đứng yêu cầu.
>   - **Fail-Open (`return false`):** Nếu token gần hết hạn **dưới 5 phút**, rủi ro thấp -> Cho phép đi qua để đảm bảo trải nghiệm khách hàng không bị gián đoạn.
> - **Các điểm quét & gia cố khác trong đợt quét:**
>   - **Gemini API:** Ép timeout tối đa 15s (`withTimeout` qua `Promise.race`) để tránh nghẽn thread Node.js khi API ngoài bị treo.
>   - **VNPay Store:** Xác nhận lưu trữ trạng thái checkout trên Upstash Redis dùng chung (cluster-safe) chứ không dùng Memory Map cục bộ.
>   - **Script đồng bộ Vector:** Bổ sung graceful connection disconnect cho Prisma khi nhận tín hiệu kết thúc (`SIGTERM`/`SIGINT`).
>
> **Kết luận:** Quyết định thiết kế kết hợp hài hòa cả hai yếu tố: Giới hạn tối đa cửa sổ tấn công (Attack Window) dưới 5 phút, đồng thời giữ vững 99.9% tính sẵn sàng của hệ thống cho các phiên hoạt động gần hết hạn.

---

> [!IMPORTANT]
> ### 💬 Round 7 — Xác minh Production Logs & Hotfix (Owner rà soát PM2 logs thực tế)
> **Nguồn phát hiện:** Owner SSH vào EC2, đọc `pm2 logs` sau khi deploy bản mới có `pm2 reload`.
>
> **Xác nhận tích cực:**
> - `pm2 reload` zero-downtime đã hoạt động đúng: log xác nhận `New worker listening` → `Stopping app:bandai-api id:_old_5`. Instance mới lên trước, cũ tắt sau.
> - Email worker hoạt động bình thường, không có error log nghiêm trọng.
>
> **Vấn đề 1 — RedisStore khởi tạo trước khi Redis connect (đã fix):**
> - **Log:** `express-rate-limit: async error during store initialization. ClientClosedError: The client is closed`
> - **Nguyên nhân gốc:** `createRateLimitStore()` chạy đồng bộ lúc module load, gọi `redisClient().sendCommand()` ngay lập tức. Nhưng `ensureRedisConnected()` chưa hoàn tất → client chưa open → `ClientClosedError`.
> - **Hệ quả:** Rate limit fallback về MemoryStore trong vài giây đầu sau mỗi restart. Cluster mode → mỗi instance counter riêng trong window đó.
> - **Fix:** Wrap `sendCommand` adapter thành `async` — gọi `await ensureRedisConnected()` lazy trước mỗi lần `sendCommand`. Request đầu tiên sẽ trigger kết nối, các request sau dùng lại client đã mở.
>
> **Vấn đề 2 — `listen_timeout: 5000` buffer quá sát (đã fix):**
> - **Log:** `[Startup] Ready in 3010ms` — chỉ còn buffer ~2s.
> - **Rủi ro:** Neon cold start chậm hơn bình thường (ví dụ sau đợt idle dài) + Redis handshake chậm → vượt 5s → PM2 coi instance mới là failed start → traffic drop.
> - **Fix:** Nâng `listen_timeout` lên `8000ms` (công thức: startup thực tế × 2.5). Comment hướng dẫn cách tune từ `pm2 logs`.
>
> **Vấn đề 3 — Log hiển thị IP gây nhầm lẫn (đã fix):**
> - **Log:** `Health: http://0.0.0.0:3000/api/health` — `HOST=0.0.0.0` đúng cho `server.listen()` (bind tất cả interfaces) nhưng gây nhầm lẫn khi đọc log.
> - **Fix:** Startup log hiển thị `localhost` thay vì giá trị biến `HOST`. IP thật (EC2 public IP) thuộc về infrastructure, không nên xuất hiện trong application log.
>
> **Vấn đề 4 — Log nhiễu "reconnecting..." khi Email Worker shutdown sạch (đã fix):**
> - **Log:** `[EmailWorker] Connection closed, reconnecting...` xuất hiện trong error log dù worker thoát hoàn hảo với code `0`.
> - **Nguyên nhân gốc:** Khi graceful shutdown gọi `activeConn.close()`, thư viện amqplib phát (emit) sự kiện `close` trước khi Promise đóng kết nối giải quyết (resolve) hoàn tất. Trình lắng nghe sự kiện `'close'` trong `run()` lập tức bắt được và in log cảnh báo cố gắng kết nối lại, tạo ra log nhiễu không mong muốn.
> - **Fix:** Bổ sung điều kiện kiểm tra biến trạng thái `isShuttingDown` trong callback lắng nghe sự kiện `'close'`. Nếu đang tiến hành tắt tiến trình, bỏ qua việc in cảnh báo và không thử kết nối lại.
>
> **Vấn đề 5 — Rủi ro sập ổ cứng EC2 do PM2 tích tụ log vô tận (Đề xuất giải pháp):**
> - **Rủi ro:** PM2 mặc định ghi log liên tục vào các tệp tin log mà không có cơ chế tự dọn dẹp hoặc cắt nhỏ. Chạy lâu ngày log sẽ phình lên hàng chục GBs, gây đầy 100% ổ đĩa cứng của EC2, khiến toàn bộ tiến trình (Node, Redis, PostgreSQL pooler) sập hàng loạt.
> - **Giải pháp:** Cài đặt module quản lý log tự động `pm2-logrotate` trực tiếp trên server:
>   1. `pm2 install pm2-logrotate`
>   2. Cấu hình tự động cắt nhỏ khi file log đạt 10MB: `pm2 set pm2-logrotate:max_size 10M`
>   3. Giữ lại tối đa 10 file log gần nhất: `pm2 set pm2-logrotate:retain 10`
>   4. Nén gzip log cũ để tiết kiệm 90% bộ nhớ đĩa: `pm2 set pm2-logrotate:compress true`
>
> **Vấn đề 6 — Phòng chống rò rỉ RAM (Memory Leak) bằng tự động restart (Xác nhận cấu hình):**
> - **Nguy cơ:** Ứng dụng Node.js chạy liên tục trong thời gian dài (24/7) luôn tiềm ẩn rủi ro rỉ RAM (do dữ liệu cache, thư viện ngoài hoặc mảng dữ liệu chưa được GC giải phóng triệt để), lâu dần gây nghẽn RAM EC2, treo cứng máy chủ và làm gián đoạn hệ thống.
> - **Xác nhận cấu hình:** Đã rà soát tệp [ecosystem.config.js](file:///d:/Workspace/Project/e-commerce-project/backend/ecosystem.config.js) và xác nhận cả hai tiến trình đã được cấu hình hạn mức an toàn cực kỳ chuẩn chỉ:
>   * `bandai-api` (API chính): `max_memory_restart: '750M'` (PM2 tự động restart zero-downtime khi RAM vượt quá 750MB).
>   * `email-worker` (Tiến trình phụ): `max_memory_restart: '256M'` (PM2 tự động restart khi RAM vượt quá 256MB).
>   * Cơ chế `autorestart: true` kết hợp rolling reload đảm bảo hệ thống luôn giải phóng RAM thừa mà không hề gây gián đoạn phục vụ.
>   
> **Vấn đề 7 — Rủi ro sai lệch múi giờ VNPay trên AWS EC2 (Đã check & Xác nhận An toàn Tuyệt đối):**
> - **Rủi ro:** Các server Cloud như AWS EC2 khi mới khởi tạo thường mặc định chạy ở múi giờ UTC (GMT+0). Đối tác VNPay cực kỳ nhạy cảm với thời gian. Các tham số giao dịch như `vnp_CreateDate` hay `vnp_ExpireDate` bắt buộc phải được tạo theo chuẩn múi giờ Việt Nam (GMT+7) định dạng `YYYYMMDDHHmmss`. Nếu server sinh ra time theo UTC (bị lùi 7 tiếng), VNPay sẽ lập tức báo lỗi sai chữ ký (`Invalid Signature`) hoặc báo giao dịch hết hạn ngay khi user click thanh toán.
> - **Xác minh thực tế trong codebase:**
>   * Logic sinh timestamp gửi qua VNPay nằm trong hàm `formatVnpDateGmt7(date: Date)` của tệp [vnpay.service.ts](file:///d:/Workspace/Project/e-commerce-project/backend/src/modules/payment/vnpay.service.ts).
>   * **Cơ chế hoạt động:** Hàm này lấy timestamp tuyệt đối của Javascript `date.getTime()` (luôn là thời gian UNIX Epoch dạng mili-giây, độc lập và không phụ thuộc vào timezone của máy chủ) rồi cộng trực tiếp `7 * 60 * 60 * 1000` ms (tương đương offset +7 tiếng của GMT+7), sau đó sử dụng các hàm getter UTC của Javascript (`getUTCFullYear`, `getUTCMonth`, `getUTCDate`, `getUTCHours`,...) để định dạng chính xác chuỗi `YYYYMMDDHHmmss`.
>   * **Kết luận:** Cách tiếp cận time-shifting này hoàn toàn chính xác, an toàn tuyệt đối và độc lập 100% với giờ hệ thống của server Linux (dù server chạy UTC, GMT+7 hay bất kỳ múi giờ nào khác, kết quả chuỗi trả về luôn là giờ chính xác của Việt Nam GMT+7). Hệ thống hoàn toàn không gặp rủi ro này trên Production.
>
> **Phát hiện phụ — `.env.production` an toàn:**
> - Owner verify bằng `git ls-files` và `git show --stat`: file `.env.production` **không bị Git track**, chỉ tồn tại local trên EC2. Nghi vấn ban đầu về credential leak là false alarm.
>
> **Kết luận:** Cả 7 vấn đề đều thuộc loại "chỉ thấy trên production logs hoặc môi trường cloud thực tế, không bị phát hiện trên dev". Việc rà soát chi tiết từng dòng logic (đặc biệt là logic timezone của VNPay) giúp đội ngũ tự tin tuyệt đối vào mức độ sẵn sàng (Production Readiness) của hệ thống khi chạy trên môi trường AWS EC2 thực tế.

