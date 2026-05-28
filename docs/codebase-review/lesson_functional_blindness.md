# 🧠 Bài Học Thực Chiến: Hội Chứng Mù Chức Năng (Functional Blindness) & Nợ Kỹ Thuật

Tài liệu này ghi nhận lại một case study thực tế cực kỳ đắt giá trong dự án E-Commerce, xảy ra tại **Round 11**. Mặc dù hệ thống đã trải qua 11 vòng audit code vô cùng gắt gao, phát hiện hàng tá lỗi bảo mật (RabbitMQ), nghẽn cổ chai (Prisma Pool) và hổng logic (VNPay), nhưng một lỗi kiến trúc nghiêm trọng lại lọt lưới hoàn toàn cho đến phút chót: **Lưu Full URL của hình ảnh S3 vào Database thay vì lưu S3 Key.**

Dưới đây là 4 nguyên nhân gốc rễ (Root Causes) đúc kết được:

---

### 1. Bẫy "Nó vẫn chạy hoàn hảo" (Functional Blindness)
Đa số các lỗi chúng ta tìm và diệt ở các Round trước là những lỗi sinh ra **hậu quả nhãn tiền**: server sập, API trả lỗi 500, hay transaction database bị lock. 

Ngược lại, việc lưu Full URL vào database hoàn toàn không sinh ra lỗi nào trong giai đoạn hiện tại. Hình ảnh vẫn render trên giao diện cực kỳ mượt mà. Bộ não của kỹ sư (và cả AI) thường có thiên kiến bỏ qua các đoạn code "đang hoạt động đúng yêu cầu tính năng" để dồn tài nguyên trí tuệ vào những function phức tạp hơn. Hậu quả là những **Khoản nợ kỹ thuật (Tech Debt)** mang tính kiến trúc bị chôn vùi.

### 2. Sự "tiếp tay" của Zod Schema
Trong `product.schema.ts`, trường `imageUrl` được khai báo là:
```typescript
imageUrl: z.string().url('Invalid URL')
```
Validation `.url()` này đã làm rất tốt nhiệm vụ của nó, nhưng vô tình lại ép hệ thống **phải** nhận một Full URL hợp lệ (có `http://`). Nếu ngay từ đầu, thiết kế Data Model định nghĩa trường này là S3 Key (chỉ cho phép các string dạng `products/abc.webp`), hệ thống sẽ quăng lỗi 400 Bad Request ngay từ ngày đầu test API, ép kỹ sư phải sửa luồng upload. Schema đã hợp thức hóa cái sai.

### 3. Hiệu ứng Silo (Đứt gãy Context giữa các Service)
Code review thường là quá trình đọc từng file độc lập:
- Khi soi `upload.service.ts`: Việc trả về `publicUrl` (Full link S3) là chuẩn mực chung của các dịch vụ Upload. Hoàn toàn hợp lý!
- Khi soi `product.service.ts`: Việc nhận tham số `imageUrl` và insert vào DB không có gì sai logic. Hoàn toàn hợp lý!

**Vấn đề nằm ở chặng giữa (Data Flow):** Sự bất hợp lý chỉ lộ diện khi ta chủ ý theo dõi vòng đời của một string kể từ lúc Upload thành công ở Frontend -> Truyền vào Body -> Lưu vào DB. Việc ghép nối bối cảnh (Context Stitching) này là cực kỳ khó nếu chỉ nhìn qua lăng kính từng file đơn lẻ.

### 4. Bị cuốn vào các "Trận đánh lớn"
Tại môi trường Production, tâm lý phòng thủ thường đặt rủi ro An ninh và Độ ổn định lên cao nhất. Khi dự án đang phải gồng mình chống chịu Hacker scan port RabbitMQ, chống Spam API AI làm cạn kiệt túi tiền, hoặc thiết kế luồng Idempotency cứu cánh cho VNPay IPN... thì một vấn đề cấu trúc URL tĩnh được bộ não xếp vào dạng "Tối ưu hóa Phase 2". Bức tranh sinh tồn đã làm lu mờ bức tranh kiến trúc.

---

### 💡 Bài Học Rút Ra (Takeaway)

1. **Sức mạnh của Cross-Review:** Việc phát hiện lỗi này đến từ một góc nhìn ngoài cuộc (người quen của Owner). Nhìn hệ thống từ lăng kính Data/DevOps thay vì lăng kính Application Dev giúp phá vỡ "Hiệu ứng Silo".
2. **Nguyên tắc "Single Source of Truth":** Việc thiết kế sẵn một Helper tập trung như `resolveImageUrl()` tại backend chính là chiếc phao cứu sinh hoàn hảo. Nếu sau này CDN đổi tên miền, chỉ việc đổi 1 biến môi trường duy nhất thay vì chạy Script Migration update hàng triệu dòng trong Database. Kiến trúc tốt sẽ dung thứ cho nợ kỹ thuật.
