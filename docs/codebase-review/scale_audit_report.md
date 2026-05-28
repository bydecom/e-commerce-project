# 🔍 Audit: Tiềm Ẩn Kỹ Thuật Khi Scale — Kết Quả Rà Soát Toàn Codebase

> **Trigger:** Sau bài học Task 4.4 (lưu Full URL thay vì S3 Key), tiến hành quét toàn bộ codebase backend để tìm các anti-pattern tương tự.
> **Phương pháp:** Scan Zod schemas, data mappers, service layers theo 3 trục: (1) Schema quá cứng, (2) Data lưu phụ thuộc hạ tầng, (3) Anti-pattern scale.

---

## 🟢 AN TOÀN — Thiết kế tốt, không cần sửa

### ✅ `order.service.ts` — Price Snapshot (Thiết kế chuẩn)
```typescript
const unitPrice = product.price; // Snapshot giá tại thời điểm đặt hàng
lines.push({ productId, quantity, unitPrice });
```
**Đánh giá:** Đây là **thiết kế đúng chuẩn E-Commerce**. Hệ thống lưu `unitPrice` vào `OrderItem` thay vì chỉ lưu `productId` và lookup giá sau. Nếu Admin đổi giá sản phẩm, các đơn hàng cũ vẫn hiển thị đúng giá gốc. **Không vấn đề gì.**

### ✅ `system-config.service.ts` — Dynamic Config Architecture (Thiết kế xuất sắc)
Hệ thống đã có cơ chế cực kỳ tốt: tất cả config runtime (TTL, API keys, VNPay secrets) đều được quản lý qua DB với fallback về env var. Đặc biệt:
- Sensitive keys (`gemini_api_key`, `vnp_hash_secret`) được encrypt trước khi lưu DB
- In-memory cache 30s tránh query DB liên tục
- `getEnvFallback()` đảm bảo hoạt động ngay cả khi DB chưa có config

**Đánh giá:** Pattern này là **best practice cho dynamic configuration**. Hoàn toàn scale được.

### ✅ `shippingAddress` — String dạng free-text (Chấp nhận được ở Phase 1)
```typescript
shippingAddress: z.string().trim().min(1, 'Shipping address is required')
```
Lưu dạng chuỗi tự do là hợp lý ở Phase 1 (xem chi tiết tại mục 🟡 bên dưới về plan cho Phase 2).

---

## 🟡 CHÚ Ý — Không lỗi ngay, nhưng cần plan khi scale

### ⚠️ 1. `store-setting.schema.ts` — `logoUrl` dùng `.url()` (Cùng lỗi với imageUrl trước đây)

**File:** `backend/src/modules/store-setting/store-setting.schema.ts:6`
```typescript
// HIỆN TẠI — lỗi tiềm ẩn:
logoUrl: z.string().url('Invalid URL').optional().nullable().or(z.literal(''))
```

**Vấn đề:** Hoàn toàn cùng pattern với `imageUrl` của Product trước Task 4.4. `logoUrl` của Store đang lưu Full URL (CloudFront hoặc S3) vào DB. Nếu đổi CDN/domain → logo store bị vỡ, phải viết SQL migration.

**Mức độ rủi ro:** 🟡 **Trung bình** — Logo store chỉ có 1 record (không phải hàng ngàn như product). Migration dễ hơn nhiều, nhưng vẫn là nợ kỹ thuật.

**Fix đề xuất:**
```typescript
// Sửa schema: chấp nhận key format
logoUrl: z.string().trim().min(1).optional().nullable().or(z.literal(''))
```
Và apply `resolveImageUrl()` trong `store-setting.service.ts` khi trả response (tương tự `mapProduct`).

---

### ⚠️ 2. `system-config` — `vnp_return_url` lưu Full URL trong DB

**File:** `backend/src/modules/system-config/system-config.service.ts:80-91`
```typescript
vnp_return_url: {
  validate: (v) => {
    new URL(v.trim()); // Validate phải là full URL hợp lệ
    return null;
  }
}
```

**Vấn đề:** `vnp_return_url` cho phép Admin lưu một URL cụ thể vào DB (ví dụ `https://d1abc.cloudfront.net/payment/result`). Nếu domain CloudFront frontend thay đổi → phải vào Admin Dashboard sửa tay. Đây là **manual step dễ bị quên** khi migrate hạ tầng.

**Mức độ rủi ro:** 🟡 **Trung bình** — Không tự vỡ, nhưng phải nhớ cập nhật thủ công sau mỗi lần đổi domain frontend.

**Đề xuất:** Thêm vào `Deployment Checklist` (không cần sửa code vì đây là cấu hình có chủ đích của Admin).

---

### ⚠️ 3. `shippingAddress` — Lưu dạng String tự do (Scale risk)

**File:** `backend/src/modules/order/order.schema.ts:5`
```typescript
shippingAddress: z.string().trim().min(1, 'Shipping address is required')
```

**Vấn đề hiện tại:** Địa chỉ giao hàng lưu dạng free-text (`"123 Nguyễn Huệ, Quận 1, TP.HCM"`). Khi scale lên:
- **Không thể filter/group đơn hàng theo tỉnh/thành phố** — phải dùng full-text search tốn kém
- **Không tích hợp được** với các API giao hàng (GHTK, GHN) đòi hỏi địa chỉ có cấu trúc (province, district, ward codes)
- **Không validate được** địa chỉ hợp lệ theo database hành chính Việt Nam

**Mức độ rủi ro:** 🟡 **Thấp ở hiện tại, Cao khi scale** — Khi tích hợp shipping API sẽ phải migrate DB + refactor toàn bộ checkout flow.

**Kế hoạch Phase 2:** Chuyển sang lưu structured address:
```typescript
// Thay thế shippingAddress: string bằng:
shippingProvinceCode: string  // "79" (TP.HCM)
shippingDistrictCode: string  // "760" (Quận 1)
shippingWardCode:     string  // "26734"
shippingStreet:       string  // "123 Nguyễn Huệ"
// shippingAddress giữ lại làm denormalized string cho display
```

---

### ⚠️ 4. `system-config` — In-memory cache KHÔNG shared giữa các PM2 instances

**File:** `backend/src/modules/system-config/system-config.service.ts:104-106`
```typescript
type CacheEntry = { value: string; expiresAt: number };
const cache = new Map<ConfigKey, CacheEntry>(); // ← In-memory, per-process!
const CACHE_TTL_MS = 30_000;
```

**Vấn đề:** Khi chạy PM2 Cluster mode (2+ instances), mỗi instance có cache Map riêng. Nếu Admin cập nhật config qua Dashboard → `clearSystemConfigCache()` chỉ clear cache của instance đang nhận request. Các instance còn lại vẫn dùng giá trị cũ trong tối đa 30 giây.

**Mức độ rủi ro:** 🟡 **Thấp** — TTL chỉ 30 giây, tự expire. Nhưng nếu config nhạy cảm như `checkout_reservation_ttl_seconds` bị đổi, hành vi sẽ không nhất quán tạm thời giữa các instance.

**Fix khi scale:** Chuyển `cache` sang Redis:
```typescript
// Thay Map bằng Redis key với TTL
await redisClient().setex(`syscfg:${key}`, 30, value);
```
Khi đó `clearSystemConfigCache()` chỉ cần `DEL syscfg:${key}` trên Redis — tất cả instances đều thấy ngay.

---

## 🔴 VẤN ĐỀ CẦN SỬA NGAY

### 🚨 `store-setting` — `logoUrl` cùng lỗi với imageUrl (Cần fix trước khi push Prod)

Đây là vấn đề ưu tiên cao nhất vì **pattern hoàn toàn giống Task 4.4** vừa fix xong. Không fix ngay tức là để lại nợ kỹ thuật đã biết.

**Files cần sửa:**
1. `store-setting.schema.ts` — bỏ `.url()` validation
2. `store-setting.service.ts` — apply `resolveImageUrl()` khi trả response

---

## 📊 Bảng Tổng Hợp

| # | Vị trí | Vấn đề | Mức độ | Cần sửa ngay? |
|---|---|---|---|---|
| 1 | `store-setting.schema.ts:6` | `logoUrl` lưu Full URL (cùng pattern imageUrl) | 🔴 Cao | ✅ **Đã fix (Round 11)** |
| 2 | `system-config` — `vnp_return_url` | URL cứng trong DB, phải sửa tay khi đổi domain | 🟡 Thấp | Không — thêm checklist |
| 3 | `order.schema.ts` — `shippingAddress` | String tự do, không scale được với Shipping API | 🟡 Trung bình | Không — Phase 2 |
| 4 | `system-config.service.ts` — in-memory cache | Cache không shared giữa PM2 instances | 🟡 Thấp | Không — khi bật cluster |
| 5 | `order.service.ts` — `unitPrice` snapshot | Thiết kế đúng ✅ | ✅ Ổn | Không cần sửa |
| 6 | `system-config.service.ts` — dynamic config | Kiến trúc xuất sắc ✅ | ✅ Ổn | Không cần sửa |
