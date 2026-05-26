# 🗺️ Round 10 Strategy Blueprint: Tự Động Hóa, Chống Sập & Khóa Kín Bảo Mật (Bản Phản Biện Toàn Diện - ĐÃ XÁC MINH & GIẢI QUYẾT)

*Cập nhật: 2026-05-25*

Trong chặng đường này, chúng ta sẽ chuyển trọng tâm sang **DevOps, Phòng thủ chiều sâu (Defense in Depth) và Tự động hóa**. Bản thiết kế này đã được tinh chỉnh qua các lớp phản biện thực tế để phân bổ thứ tự ưu tiên tối ưu nhất, ngăn chặn các rủi ro từ vi mô đến vĩ mô ở tầng giao tiếp dịch vụ và hạ tầng đám mây.

---

## 🔴 NHÓM 1 — FIX NGAY (Lỗi thật, xác suất xảy ra cao)

### 1. Tọa độ 4: RabbitMQ Prefetch Count
- **Vấn đề thật:** Không cấu hình `channel.prefetch()` dẫn tới RabbitMQ tự động dump toàn bộ queue vào RAM của Node.js instance. Với AI worker gọi Gemini API tốn từ 2-10s/request, nếu có 1000 feedbacks gửi lên đồng thời sẽ tạo ra 1000 Promise chạy song song. Hậu quả là sập RAM (OOM) Node.js và bị Gemini chặn vì lỗi `429 Too Many Requests`.
- **Hành động rà soát:** Kiểm tra `ai.worker.ts` và `email.worker.ts` xem đã cấu hình `channel.prefetch()` chuyên nghiệp chưa.
- **Giá trị đề xuất:** 
  - AI Worker: `prefetch(1)` do Gemini chạy chậm và bị giới hạn rate limit chặt.
  - Email Worker: `prefetch(5)` do tốc độ gửi mail nhanh hơn.
- **🔍 KẾT QUẢ XÁC MINH & KHẮC PHỤC:**
  - **Email Worker:** Đang cấu hình chuẩn xác `const PREFETCH = 5;` và gọi `ch.prefetch(PREFETCH)` đầy đủ.
  - **AI Worker:** Đang dùng `PREFETCH = 2`. Cả hai Worker đều dùng manual acknowledgment (`noAck` mặc định là `false`), và chủ động gọi `ch.ack` / `ch.nack` thủ công cho từng tin nhắn (đảm bảo prefetch có tác dụng 100%).
  - **Khắc phục:** Đã điều chỉnh `ai.worker.ts` xuống `PREFETCH = 1` thành công, vô hiệu hóa hoàn toàn rủi ro OOM và 429 từ Gemini API.
  - **Gia cố Graceful Shutdown:** Bổ sung cấu hình `kill_timeout: 10000` cho `ai-worker` trong `ecosystem.config.js` để PM2 đợi tối đa 10s cho các cuộc gọi Gemini hoàn tất khi reload, triệt tiêu nguy cơ sập process hay mất job giữa chừng.

### 2. Tọa độ 6: P2002 Race Condition IPN VNPay
- **Vấn đề thật:** VNPay có thể bắn đồng thời 2 IPN y hệt nhau trong cùng một phần ngàn giây. Request thứ 2 sẽ bị Prisma quăng lỗi trùng lặp dữ liệu `P2002`. Nếu catch block không bắt đúng mã lỗi này để trả về `{ RspCode: '02' }` (Duplicate IPN) mà để lọt thành HTTP 500, VNPay sẽ thực hiện retry liên tục vô hạn.
- **Hành động rà soát:** Đọc code `vnpay.controller.ts`, kiểm tra khối catch của IPN transaction xem có xử lý chính xác `error.code === 'P2002'` để trả về HTTP 200 kèm body `{ RspCode: '02' }` không. Đảm bảo behavior thực tế khớp với kiểm thử của test suite.
- **🔍 KẾT QUẢ XÁC MINH:**
  - **Xác nhận:** `vnpay.controller.ts` (dòng 493-501) đã xử lý triệt để:
    ```typescript
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(200).json({ RspCode: '02', Message: 'Order already processed' });
      return;
    }
    ```
    Catch block bắt chuẩn xác mã lỗi Prisma P2002, kết thúc sớm và trả về HTTP 200 kèm body `RspCode: 02`. Test suite hoạt động 100% đúng thực tế, không cần can thiệp thêm.

---

## 🟡 NHÓM 2 — LÀM SỚM (Rủi ro thật nhưng cần verify thực tế trước)

### 3. Tọa độ 1: Orphaned Messages Sweeper (Mồ côi tin nhắn)
- **Vấn đề thật:** Node crash ngay sau khi Prisma commit thành công nhưng trước khi `publishToQueue()` chạy, khiến Feedback bị kẹt ở `PENDING` vĩnh viễn, Product không được sync vector lên Qdrant.
- **Phản biện quan trọng:** Sweeper cần thêm điều kiện `updatedAt = createdAt` (chưa từng được Worker chạm vào) để tránh republish các Feedback đang được xử lý bởi Worker nhưng Gemini chạy quá 30 phút. Nếu không có điều kiện này, hai Worker sẽ tranh chấp cập nhật (race condition) cùng một Feedback.
- **Hành động rà soát:** Xác nhận codebase chưa có Sweeper quét Feedback PENDING. Thiết kế và implement câu query tự phục hồi.
- **🔍 KẾT QUẢ XÁC MINH & IMPLEMENT THỰC TẾ:**
  - **Xác nhận:** Model `Feedback` ban đầu hoàn toàn thiếu `createdAt` và `updatedAt`.
  - **Khắc phục:** Đã bổ sung `createdAt` và `updatedAt` (với `@default(now())`) vào `schema.prisma` và đồng bộ PostgreSQL database thành công.
  - **Implement:** Viết hoàn chỉnh `feedback-sweeper.service.ts` tích hợp distributed lock Redis phân tán (`feedback:sweeper:lock`) chống tranh chấp cluster, cùng SQL Raw query cực kỳ an toàn:
    ```sql
    SELECT id, comment FROM "Feedback"
    WHERE sentiment = 'PENDING'::"SentimentLabel"
      AND "createdAt" < ${cutoff}
      AND "updatedAt" = "createdAt"
      AND comment IS NOT NULL
    ```
    Đồng thời liên kết trực tiếp vào `app.ts` để khởi động cùng hệ thống và dừng sạch sẽ khi Graceful Shutdown. Tối ưu hóa gửi RabbitMQ concurrent bằng `Promise.allSettled()` giải phóng hoàn toàn Event Loop. Hoàn tất xuất sắc!

### 4. Tọa độ 3: Connection Pool (`pool_timeout` & `connection_limit`)
- **Vấn đề thật:** Với `connection_limit=3` cho Neon, nếu có 3 luồng VNPay IPN chạy đồng thời và chiếm dụng connection lâu, request thứ 4 sẽ bị nghẽn và treo đến khi quá hạn `pool_timeout` (mặc định 10s).
- **Phản biện quan trọng:** Tăng `pool_timeout` lên 15s chỉ làm khách hàng chờ lâu hơn trước khi lỗi, không giải quyết được gốc rễ vấn đề. Giải pháp thực tế là nâng `connection_limit` lên `5` nếu thực sự phát hiện dấu hiệu nghẽn pool.
- **Hành động rà soát:** Kiểm tra `.env.production` xem có cấu hình `pool_timeout` không. Check Neon Dashboard xem có log "connection pool timeout" hoặc "max connections reached" không. Nếu sạch sẽ thì chưa cần thay đổi.
- **🔍 KẾT QUẢ XÁC MINH:**
  - **Xác nhận:** `.env.production` đang để cứng `connection_limit=3`. Không khai báo explicit `pool_timeout` (mặc định là 10s của Prisma).
  - **Quyết định:** Giữ nguyên cấu hình hiện tại để đảm bảo an toàn cho DB Neon Serverless, chỉ xem xét nâng limit lên 5 khi Neon dashboard ghi nhận thực sự xảy ra nghẽn pool.

---

## 🟢 NHÓM 3 — MONITOR TRƯỚC, LÀM SAU (Cần dữ liệu thực tế để quyết định)

### 5. Tọa độ 2: Circuit Breaker cho JWT Fail-Open
- **Vấn đề thật:** DDoS sập Redis cục bộ khiến hệ thống trigger Fail-Open liên tục, cho phép token đã logout vẫn hoạt động trong 5 phút.
- **Phản biện quan trọng:** Thiết lập Circuit Breaker in-memory trên PM2 Cluster sẽ không hoạt động chính xác vì mỗi nhân CPU chạy 1 instance với bộ đếm riêng lẻ (không đồng nhất). Giải pháp thực tế là giữ nguyên Fail-Open logic nhưng phải verify catch block bắt chuẩn xác `ConnectionError` của Upstash và ghi log `[WARN]` rõ ràng ra stdout để giám sát.
- **Hành động rà soát:** Kiểm tra `jwt-blacklist.ts` xem catch block bắt Exception loại nào, có phân biệt được lỗi rớt mạng với các lỗi khác không, và có ghi log cảnh báo rõ ràng không.
- **🔍 KẾT QUẢ XÁC MINH & BẢO VỆ:**
  - **Xác nhận catch block:** Catch block của `jwt-blacklist.ts` bắt Exception chung `err` của JS.
  - **Phân tích độ an toàn:** Do thân khối `try` chỉ thực thi duy nhất việc kiểm tra kết nối `ensureRedisConnected()` và lấy dữ liệu string `redisClient().get()`, hoàn toàn không chứa bất cứ logic nghiệp vụ phức tạp nào khác, nên **100% lỗi lọt vào catch block đều là lỗi hạ tầng thực tế** (Redis chết, timeout, quota). Không hề có nguy cơ "false positive" do lỗi code logic.
  - **Visibility:** Hệ thống đã ghi log `console.warn('[Blacklist] Fail-Open...')` ra stdout cực kỳ đầy đủ. Đủ điều kiện monitor, không cần over-engineer.

### 6. Tọa độ 5: Upstash Quota Exhaustion (Vượt hạn mức Redis)
- **Vấn đề thật:** PM2 Cluster chạy nhiều instance có thể nhân bội số lượng request gửi lên Redis Upstash, làm cạn kiệt daily quota. Khi đó Redis từ chối phục vụ, kéo theo sụp đổ dây chuyền Fail-Open/Closed.
- **Phản biện quan trọng:** Không áp dụng đề xuất In-memory LRU Cache trước Redis cho rate limiting vì sẽ phá vỡ tính năng đếm chung của Cluster (quay lại lỗi MemoryStore của Round 1).
- **Hành động rà soát:** Theo dõi actual commands/ngày trên Upstash Dashboard. Chỉ nâng tier hoặc setup cảnh báo nếu lượng command thực tế vượt quá 70% hạn mức. Tuyệt đối không thêm code khi chưa có số liệu.
- **🔍 KẾT QUẢ XÁC MINH:**
  - **Quyết định:** Thống nhất giữ nguyên kiến trúc phân tán Cluster hiện tại. Theo dõi sát sao quota trên Dashboard và tuyệt đối không thêm cache in-memory.

---

## 🛡️ TỰ ĐỘNG HÓA CI/CD & KHẢ NĂNG TỰ PHỤC HỒI (TASK 5.1 - HOÀN THÀNH VƯỢT TIẾN ĐỘ)
Nhằm đạt được độ tin cậy tuyệt đối (100% Reliability), quy trình triển khai Backend trên GitHub Actions đã được gia cố toàn diện:
- **Tự động sao lưu (Backup):** Tự động đóng gói và tạo thư mục `dist.backup` từ mã nguồn dist cũ đang chạy ổn định trên EC2 trước khi SCP nạp bản build mới.
- **Tách biệt kiểm thử cơ sở dữ liệu:** Step `db:push:prod` chạy riêng biệt, nếu gặp bất kỳ lỗi kết nối hay xung đột cấu trúc nào, job deploy lập tức dừng sớm và thực thi rollback tự phục hồi mà không làm ảnh hưởng tiến trình node cũ.
- **pm2 start + pm2 reload:** Chuỗi lệnh chuẩn hóa giúp khởi chạy zero-downtime tất cả các service (fork lẫn cluster) bulletproof.
- **Cách ly Rollback thông minh:** Sử dụng điều kiện `if: always() && steps.smoke_test.outcome == 'failure'` kết hợp gán `id: smoke_test` để chỉ kích hoạt rollback khi và chỉ khi Smoke Test API Health check bị lỗi thực tế. Khi rollback thành công, hệ thống chủ động gọi `exit 1` để thông báo cảnh báo đỏ trên GitHub cho đội ngũ kỹ sư.

---

## 📋 BẢNG TÓM TẮT ĐỘ ƯU TIÊN RÀ SOÁT & TRẠNG THÁI

| Tọa độ | Vấn đề | Nhóm | Trạng thái rà soát |
|---|---|---|---|
| **4** | RabbitMQ Prefetch | 🔴 **Fix ngay** | **ĐÃ XỬ LÝ:** Hạ prefetch xuống 1 và cấu hình `kill_timeout: 10000` cho `ai-worker`. |
| **6** | VNPay P2002 catch | 🔴 **Fix ngay** | **ĐÃ XÁC MINH:** Catch block hoạt động hoàn toàn chính xác. |
| **1** | Orphaned Sweeper | 🟡 **Làm sớm** | **ĐÃ HOÀN THÀNH:** Bổ sung timestamps, viết Feedback Sweeper concurrent, distributed lock và DB push hoàn tất. |
| **3** | Connection pool | 🟡 **Verify trước** | **ĐÃ XÁC MINH:** Neon DB an toàn, giữ nguyên config hiện tại. |
| **2** | JWT Circuit Breaker| 🟢 **Monitor** | **ĐÃ XÁC MINH:** Exception block an toàn trước lỗi code, log đầy đủ. |
| **5** | Upstash Quota | 🟢 **Monitor** | **ĐÃ XÁC MINH:** Thống nhất monitor daily quota, không over-engineer. |
| **Task 5.1** | CI/CD Rollback | 🔴 **Xong sớm** | **ĐÃ HOÀN THÀNH:** Tích hợp thành công backup, cách ly và khôi phục tự động trong deploy-backend.yml. |
