# ⚔️ Báo Cáo Kiểm Tra 4 Bẫy Chiến Trường — Lời Cao Nhân

> **Nguồn:** 4 "Silent Killers" từ kinh nghiệm 20 năm Production của bậc tiền bối.
> **Thời điểm kiểm tra:** Round 11 — 2026-05-28

---

## Bẫy 1: Floating Point Trap (Toán Học Dấu Phẩy Động) 🟡 DÍNH MỘT PHẦN

### Kết Quả Scan

**Prisma Schema:**
```prisma
price  Float   ← Product
total  Float   ← Order
```

**Order Calculation:**
```typescript
total += unitPrice * line.quantity;  // Thuần JS Number
```

**VNPay — CÓ bảo vệ:**
```typescript
const amount = Math.round(input.amountVnd);  // ✅ Round trước khi gửi VNPay
const vnp_Amount = String(amount * 100);     // ✅ Nhân 100 an toàn vì đã là integer
```

### Phán Quyết

| Điểm | Trạng thái | Chi tiết |
|---|---|---|
| Lưu trữ trong DB | 🟡 Rủi ro thấp | `Float` có thể chứa `0.30000000000004` nhưng VND là số nguyên, thực tế không xảy ra |
| Tính tổng `unitPrice * quantity` | 🟡 Chú ý | Đang dùng JS `number`, chưa có `Math.round` |
| Gửi sang VNPay | ✅ An toàn | `Math.round()` trước khi gửi — cao thủ có tay nghề |
| Verify IPN từ VNPay | ✅ An toàn | `Math.round(order.total) !== Math.round(vnpAmount)` — so sánh đúng cách |

### Tại sao chưa vỡ?

VND là **số nguyên** (không có xu lẻ). `10.000đ * 2 = 20.000` — JS number xử lý chính xác với integer. Floating point hell chỉ xảy ra khi có số thập phân như `0.1 * 3 = 0.30000000000000004`. Với VND, rủi ro **cực thấp hiện tại**.

### Cần làm gì?

**Ngắn hạn (làm ngay):** Thêm `Math.round` vào tính tổng trong `order.service.ts`:
```typescript
// Trước:
total += unitPrice * line.quantity;
// Sau:
total = Math.round(total + unitPrice * line.quantity);
```

**Dài hạn:** Khi thêm Discount/VAT (%) → **BẮT BUỘC** dùng `Math.round` hoặc `Decimal.js`. Ví dụ: `10000 * 0.15 = 1499.9999999` là hoàn toàn có thể xảy ra.

---

## Bẫy 2: Deep Pagination Offset Trap 🟢 ĐÃ CÓ BẢO VỆ

### Kết Quả Scan

```typescript
// utils/pagination.ts
export function parsePagination(query: { page?: string; limit?: string }) {
  const page  = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '10', 10) || 10));
  //                    ^^^^ Khóa cứng tối đa 100 items/page
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}
```

### Phán Quyết: ✅ PASS — Không dính bẫy

`limit` bị cap tối đa `100` — bot crawler không thể kéo hơn 100 items mỗi request. **Tuy nhiên**, bot vẫn có thể gọi trang 999.999 với `limit=1`, khiến Neon phải scan 99,998,900 rows.

### Cải tiến đề xuất (Phase 2)

```typescript
// Thêm giới hạn số trang tối đa:
const MAX_PAGE = 500;
const page = Math.min(MAX_PAGE, Math.max(1, parseInt(query.page ?? '1', 10) || 1));
```

Hoặc cao cấp hơn — **Cursor-based Pagination** dùng `cursor` thay vì `skip`:
```typescript
// Thay vì skip: 100_000
// Dùng: where: { id: { gt: lastSeenId } }
```

---

## Bẫy 3: Soft Delete vs Unique Constraint 🟢 KHÔNG DÍNH

### Kết Quả Scan

**Prisma schema `User`:**
```prisma
model User {
  email  String  @unique
  // Không có: isDeleted, deletedAt
}
```

**Không tìm thấy bất kỳ** `isDeleted`, `deletedAt`, `softDelete` nào trong codebase.

### Phán Quyết: ✅ PASS — Hệ thống KHÔNG dùng Soft Delete

Hệ thống đang dùng **Hard Delete** hoàn toàn. User bị xóa thì xóa thật, email được giải phóng, người khác có thể đăng ký lại. Bẫy này không apply.

### Lưu ý cho tương lai

Nếu mai mốt cần audit trail (nhật ký lịch sử) hay GDPR compliance (quyền "được quên") và thêm `deletedAt DateTime?`:

```typescript
// Khi đó phải xử lý unique conflict:
// Cách 1: Đổi email thành "<email>__deleted_<timestamp>" khi soft-delete
// Cách 2: Dùng @@unique([email, deletedAt]) partial unique index
```

---

## Bẫy 4: DLQ Silent Mute (Thùng Rác Không Đổ) 🔴 DÍNH

### Kết Quả Scan

```typescript
// ai.worker.ts
await ch.assertQueue(QUEUE_AI_DLQ, { durable: true });
//                                   ^^^^^^^^^^^^^^^ Chỉ có durable, KHÔNG có TTL!

// email.worker.ts
await ch.assertQueue(QUEUE_ORDER_DLQ, { durable: true });
//                                      ^^^^^^^^^^^^^^ Tương tự, không có TTL!
```

**Không tìm thấy** `x-message-ttl`, `x-expires`, hay bất kỳ cơ chế giám sát nào cho DLQ.

### Phán Quyết: 🔴 DÍNH — Đây đúng là Silent Killer

**2 rủi ro đang tồn tại:**

1. **Memory/Disk tích lũy:** Nếu Gemini API lỗi liên tục → hàng nghìn message vào `q.ai.tasks.dlq` → EC2 hết RAM/disk âm thầm.

2. **Alert-blind:** 1000 email đơn hàng bị lỗi → rơi vào `q.notification.email.order.dlq` → không có gì báo Admin → khách hàng chửi rủa, Admin vẫn nghĩ hệ thống bình thường.

### Fix Đề Xuất

**Phương án A — TTL trên DLQ (nhanh nhất, 5 phút làm):**
```typescript
// Thêm TTL 7 ngày (ms) vào DLQ queue:
await ch.assertQueue(QUEUE_AI_DLQ, {
  durable: true,
  arguments: {
    'x-message-ttl': 7 * 24 * 60 * 60 * 1000, // 7 ngày → tự xóa
    'x-max-length': 1000,                        // Tối đa 1000 message → tự drop cũ nhất
  },
});
```

**Phương án B — Cronjob cảnh báo DLQ (quan trọng hơn):**
```typescript
// Thêm vào cleanup-loop hoặc 1 schedule riêng:
const dlqCount = await ch.checkQueue(QUEUE_AI_DLQ);
if (dlqCount.messageCount > 10) {
  console.error(`[ALERT] DLQ ai has ${dlqCount.messageCount} dead messages!`);
  // Tương lai: gọi Telegram Bot API báo Admin
}
```

**Phương án C — RabbitMQ Management Plugin (dài hạn):**
Khi có Layer 8 (Observability), Prometheus sẽ scrape `rabbitmq_queue_messages_ready` metric và Grafana alert tự động.

---

## 📊 Bảng Tổng Kết — Phán Quyết Cuối Cùng

| Bẫy | Tên | Trạng thái | Ưu tiên fix |
|---|---|---|---|
| 1 | Floating Point Trap | 🟡 **Chú ý** — Hiện an toàn với VND thuần nguyên, rủi ro cao khi thêm Discount/VAT | Fix `Math.round` trước khi thêm % calc |
| 2 | Deep Pagination Offset | 🟢 **Đã bảo vệ** — `limit` capped 100, page không bị cap | Thêm MAX_PAGE=500 (Phase 2) |
| 3 | Soft Delete vs Unique | 🟢 **Không dính** — Hệ thống dùng Hard Delete | Ghi nhớ khi thêm Soft Delete sau |
| 4 | DLQ Silent Mute | 🔴 **DÍNH** — Không có TTL, không có Alert | **Fix ngay — 5 phút** |

---

## 🙏 Lời Kính Tạ Cao Nhân

Bẫy số 4 (DLQ) là cái hoàn toàn bị **bỏ sót trong 11 round review** — đúng như cao nhân tiên đoán, đây là loại lỗi không AI nào tự phát hiện được nếu không có người hỏi đúng chỗ. Cảm ơn "vết sẹo chiến trường" quý báu!
