# 🔬 Phản Biện Kỹ Thuật: Improvement Plan vs Thực Tế Codebase

Tài liệu này **phản biện từng mục** trong plan trước, dựa trên code thật đã quét.

> [!NOTE]
> **Lịch sử tài liệu:** Document này đã qua 3 vòng review:
> - **Round 1** — AI draft phản biện dựa trên codebase scan
> - **Round 2** — Owner phản hồi 3 điểm, AI sửa lại (symlink, feedback schema, effort estimates)
> - **Round 3** — External reviewer nhận xét về cách làm việc và confirm thứ tự ưu tiên
>
> Các block `💬 Tranh luận` trong document ghi lại quá trình hình thành quyết định. **Context tại sao chọn giải pháp này quan trọng hơn bản thân giải pháp** — khi quay lại sau 3 tháng hoặc onboard người mới, phần tranh luận sẽ có giá trị hơn phần kết luận.

### 🏗️ Production Infrastructure Map

| Component | Service | Ghi chú |Mình đọc xong conversation này rồi. Đây là nhận xét:

**Cái đáng chú ý nhất không phải là nội dung kỹ thuật — mà là cách bạn làm việc với AI.**

Bạn không chỉ đọc output rồi tin. Bạn đọc, phản biện lại 3 điểm cụ thể, và AI phải cập nhật lại tài liệu. Đây là cách dùng AI đúng — bạn là người review, AI là người draft.

Về chất lượng tranh luận của bạn: cả 3 điểm bạn phản hồi đều đúng và có lý. Symlink + `pm2 reload --update-env` là valid, AI gắn ❌ hơi mạnh tay. Feedback chỉ cần thêm `PENDING` enum không phải refactor lớn. Estimate "30 phút" cho graceful shutdown là nhìn từ góc dev có kinh nghiệm, không phải góc bạn đang đứng.

**Một điểm mình thêm vào:** tài liệu này giờ có giá trị hơn nhiều so với plan gốc, vì nó ghi lại cả *lý do tại sao* chứ không chỉ *làm gì*. Khi bạn quay lại sau 3 tháng hoặc giải thích cho người mới, context tranh luận đó quan trọng hơn kết luận.

Nếu bạn đang chuẩn bị implement, mình suggest bắt đầu từ graceful shutdown trước — 30 phút với người có kinh nghiệm, nhưng với bạn có thể là 2-4 giờ, và nó là prerequisite bắt buộc trước khi bật cluster mode. Làm sai thứ tự này thì cluster mode sẽ cắt request payment giữa chừng, không phát hiện được ngay.
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

### a) Hardcoded IP trong production code

[index.ts:23](file:///d:/Workspace/Project/e-commerce-project/backend/index.ts#L23):
```typescript
console.log(`Health:  http://3.25.162.48:${PORT}/api/health`);
```
IP public EC2 hardcoded. Nếu đổi instance → sai. Nên dùng env var hoặc bỏ.

### b) RabbitMQ production credentials yếu

[docker-compose.prod.yml](file:///d:/Workspace/Project/e-commerce-project/docker-compose.prod.yml): `admin/secret123`. Nếu port 5672 expose ra internet → ai cũng connect được. Cần:
- Không expose port 15672 (management UI) ra public
- Đổi credentials mạnh hơn, hoặc dùng AWS MQ (managed RabbitMQ)

### c) CORS hardcoded CloudFront URL

[app.ts:46](file:///d:/Workspace/Project/e-commerce-project/backend/src/app.ts#L46): `'https://d7ozoo9vtkn42.cloudfront.net'` hardcoded. Nếu đổi CloudFront distribution → phải sửa code + redeploy. Nên dùng `CLIENT_URL` env var (đã có trong README nhưng chưa dùng).

### d) Frontend `storageUrl` không dùng

`environment.prod.ts` có `storageUrl` nhưng grep cho thấy **không file nào trong `src/app/` import nó**. Images render bằng `imageUrl` từ API (đã là full S3 URL). Biến này là dead code.

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
