# 🗺️ Round 9 Strategy Blueprint: Điểm Chạm Hoàn Hảo & Hoàn Thiện Sinh Thái

*Cập nhật: 2026-05-25*

Trong chặng đường cuối cùng này, hệ thống của chúng ta đã được nâng cấp lên một tầng cao mới của "Engineering Excellence". Round 9 tập trung giải quyết những góc khuất tinh vi nhất của cả Backend lẫn Frontend, đồng thời chuẩn bị cho các phương án triển khai bảo mật cao độ trên hạ tầng đám mây.

---

## 🏆 KẾT QUẢ ĐẠT ĐƯỢC (PHẦN 1)

1. **Khắc Phục Stale Data (Frontend Cache Invalidation):**
   - **Vấn đề:** Cơ chế cache 30 giây trong Angular khiến việc thay đổi trạng thái Order (hoặc gõ tìm kiếm mới) không ngay lập tức phản hồi trên màn hình danh sách.
   - **Giải pháp:** Áp dụng mô hình Event Bus (`orderUpdated$`) thông qua `OrderApiService`. Khi có sự thay đổi, Frontend tự động kích hoạt `cache.clear()` và tải lại dữ liệu mới, duy trì sự nhất quán giữa các Component độc lập.

2. **Xử Lý Bóng Ma HTTP 304 (Express ETag):**
   - **Vấn đề:** Express tự sinh `ETag`, khiến cho dù Frontend cố tình gọi API mới, Browser vẫn ném `If-None-Match` và nhận về `304 Not Modified`, làm sai lệch kết quả lọc dữ liệu.
   - **Giải pháp:** Tắt hoàn toàn ETag ở tầng Application (`app.set('etag', false)`) đối với những luồng dữ liệu thay đổi liên tục, bảo đảm mỗi kết quả trả về luôn luôn là 200 OK nguyên bản.

3. **Chống Bypass Lọc Dữ Liệu (Prisma Required Relation):**
   - **Vấn đề:** Cú pháp `{ user: { is: { email: ... } } }` không hoạt động đối với Required Relation, khiến Prisma phớt lờ lệnh WHERE và trả về mọi bản ghi trong DB.
   - **Giải pháp:** Loại bỏ object `{ is: }` đối với tất cả các quan hệ bắt buộc (như User đối với Order/Feedback). Đảm bảo query dịch ra SQL với mệnh đề JOIN và WHERE chính xác.

4. **Khơi Thông Dòng Chảy Request (Zod Schema Validation):**
   - **Vấn đề:** Middleware chặn toàn bộ Query Parameters không khai báo trong `paginationQuerySchema` (như `search`, `status`, v.v.), làm controller luôn nhận giá trị `undefined`.
   - **Giải pháp:** Triển khai hàng loạt Schema phân hóa chi tiết (`adminOrderQuerySchema`, `productQuerySchema`, v.v.) dựa trên phương thức kế thừa `.extend()` của Zod. Bảo vệ hệ thống khỏi Injection nhưng vẫn thông suốt cho các tham số hợp lệ.

5. **Đồng Bộ Hoàn Hảo Hotline Shop Settings (Store Settings Validation):**
   - **Vấn đề:** Cả Zod Schema ở Backend và Reactive Form ở Frontend đều bỏ lọt lỗi nhập bừa bãi Hotline, gây nguy cơ rò rỉ ký tự lạ lên giao diện Storefront.
   - **Giải pháp:** Đồng bộ áp dụng Regex E.164 chặt chẽ cho trường `phone`, đi kèm cơ chế báo đỏ thông minh của HTML template khi Admin sửa cấu hình Hotline sai cú pháp.

---

## 🎯 MỤC TIÊU TIẾP THEO (PHẦN 2)

Chúng ta còn đúng 3 mảnh ghép cực kỳ quan trọng để hoàn thành 100% bản thiết kế E-Commerce siêu cấp này:

1. **Task 5.1 — CI/CD Auto Rollback:**
   - Bảo hiểm sinh mạng cho Production. 
   - Tích hợp cờ hiệu `--wait` vào lệnh `pm2 reload`.
   - Viết kịch bản ping tự động tới `/api/health`. Nếu server trả mã lỗi hoặc sập, GitHub Actions sẽ tự động rollback về bản build an toàn trước đó, đảm bảo 0% downtime.

2. **Task 4.2 — Khóa Kín S3 (AWS Bucket Policy):**
   - Chặn tuyệt đối mọi luồng truy cập HTTP tĩnh trực tiếp vào S3.
   - Buộc toàn bộ traffic tải ảnh phải đi qua cánh cổng CloudFront (CDN) bằng công nghệ OAC (Origin Access Control) / OAI. Tiết kiệm băng thông, chặn đứng spam.

3. **Task 7.2 — Stress Test Lua Script (Redis):**
   - Triệt tiêu cơn ác mộng Race Condition.
   - Dùng Jest tạo môi trường giả lập bắn phá 1000 request song song mua cùng 1 sản phẩm. Chứng minh cơ chế khóa lượng tồn kho bằng Lua script trên Redis hoàn toàn không thể bị xuyên thủng và không bao giờ cho phép trừ âm số lượng.

> *Hãy chọn nhiệm vụ mà bạn mong muốn chinh phục nhất để Antigravity bắt tay vào triển khai!*
