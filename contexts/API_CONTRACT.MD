# API Contract

**Base URL:** `http://localhost:3000/api`  
**Auth:** `Authorization: Bearer <token>` trên mọi protected route  
**IDs:** Trùng với Prisma — mọi `id`, `userId`, `productId`, `categoryId`, `orderId` trong JSON là **số nguyên (Int)**, không dùng UUID.

**Response format:**
```json
{ "success": true, "message": "OK", "data": {}, "meta": null }
{ "success": false, "message": "Error message", "errors": [] }
```

---

## Auth `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Đăng ký tài khoản |
| POST | `/auth/login` | ❌ | Đăng nhập, trả về JWT |
| POST | `/auth/logout` | ✅ User | Blacklist token hiện tại |

**POST /auth/register**
```json
// Request
{ "name": "Nguyen Van A", "email": "a@gmail.com", "password": "123456" }

// Response 201
{ "success": true, "data": { "id": 1, "name": "...", "email": "...", "role": "USER" } }
```

**POST /auth/login**
```json
// Request
{ "email": "a@gmail.com", "password": "123456" }

// Response 200
{ "success": true, "data": { "token": "jwt...", "user": { "id", "name", "email", "role" } } }
```

---

## Users `/users`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | ✅ User | Lấy profile hiện tại |
| PUT | `/users/me` | ✅ User | Cập nhật profile |

**PUT /users/me**
```json
// Request
{ "name": "New Name", "phone": "0901234567", "address": "123 ABC St" }
```

---

## Products `/products`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | ❌ | Danh sách sản phẩm (filter + search + pagination) |
| GET | `/products/:id` | ❌ | Chi tiết sản phẩm |
| POST | `/products` | ✅ Admin | Tạo sản phẩm mới |
| PUT | `/products/:id` | ✅ Admin | Cập nhật sản phẩm |
| DELETE | `/products/:id` | ✅ Admin | Xoá sản phẩm |

**GET /products — Query params**
```
?page=1&limit=12&search=keyword&categoryId=1&minPrice=0&maxPrice=1000&sort=price_asc|price_desc|newest
```
> `search` map sang cột tìm kiếm (vd. `title_unaccent` / `name` tùy implement).

**Response data item:**
```json
{
  "id": 1,
  "name": "Product Name",
  "titleUnaccent": "optional normalized title for search",
  "description": "...",
  "price": 199000,
  "stock": 50,
  "imageUrl": "https://...",
  "categoryId": 2,
  "category": { "id": 2, "name": "Category" }
}
```

**POST /products**
```json
// Request
{
  "name": "Product Name",
  "description": "...",
  "price": 199000,
  "stock": 50,
  "imageUrl": "https://...",
  "categoryId": 2
}
```
> Có thể tự sinh / cập nhật `titleUnaccent` phía server khi tạo–sửa (đồng bộ index `pg_trgm`).

---

## Categories `/categories`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/categories` | ❌ | Danh sách categories |
| POST | `/categories` | ✅ Admin | Tạo category |
| PUT | `/categories/:id` | ✅ Admin | Sửa category |
| DELETE | `/categories/:id` | ✅ Admin | Xoá category |

---

## Orders `/orders`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | ✅ User | Tạo đơn hàng mới |
| GET | `/orders/me` | ✅ User | Lịch sử đơn hàng của user |
| GET | `/orders/me/:id` | ✅ User | Chi tiết đơn hàng của user |
| PATCH | `/orders/me/:id/cancel` | ✅ User | Cancel đơn (chỉ khi PENDING) |
| GET | `/orders` | ✅ Admin | Tất cả đơn hàng |
| GET | `/orders/:id` | ✅ Admin | Chi tiết đơn hàng bất kỳ |
| PATCH | `/orders/:id/status` | ✅ Admin | Cập nhật trạng thái |

**POST /orders**
```json
// Request
{
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 3, "quantity": 1 }
  ],
  "shippingAddress": "123 ABC St"
}

// Response 201
{
  "id": 10,
  "status": "PENDING",
  "total": 597000,
  "items": [ { "productId": 1, "name": "...", "quantity": 2, "unitPrice": 199000 } ],
  "createdAt": "2024-04-10T08:00:00.000Z"
}
```

**PATCH /orders/:id/status**
```json
// Request (Admin)
{ "status": "CONFIRMED" }

// Allowed transitions:
// PENDING → CONFIRMED
// CONFIRMED → SHIPPING
// SHIPPING → DONE
// PENDING → CANCELLED
```

**GET /orders (Admin) — Query params**
```
?page=1&limit=20&status=PENDING|CONFIRMED|SHIPPING|DONE|CANCELLED
```

---

## Feedback `/feedbacks`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/feedbacks` | ✅ User | Gửi feedback (chỉ khi order DONE) |
| GET | `/feedbacks` | ✅ Admin | Tất cả feedbacks |
| GET | `/feedbacks/product/:id` | ❌ | Feedbacks của 1 sản phẩm |

**POST /feedbacks**
```json
// Request
{ "orderId": 10, "productId": 1, "rating": 5, "comment": "Sản phẩm tốt!" }

// Response 201
{ "id": 5, "rating": 5, "comment": "...", "sentiment": "POSITIVE" }
```

> `sentiment` (enum `POSITIVE` | `NEUTRAL` | `NEGATIVE`) được gán sau khi lưu — thường gọi AI nội bộ; không nhất thiết trả về ngay trong response nếu xử lý async.

---

## Dashboard `/dashboard`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard/summary` | ✅ Admin | Tổng doanh thu, tổng đơn, tổng sản phẩm |
| GET | `/dashboard/orders-by-status` | ✅ Admin | Số đơn theo từng status |
| GET | `/dashboard/top-products` | ✅ Admin | Top 5 sản phẩm bán chạy |
| GET | `/dashboard/revenue-chart` | ✅ Admin | Doanh thu theo ngày (7 hoặc 30 ngày) |

**GET /dashboard/summary**
```json
{
  "totalRevenue": 15000000,
  "totalOrders": 120,
  "totalProducts": 45,
  "totalUsers": 88
}
```

**GET /dashboard/revenue-chart?days=7**
```json
{
  "data": [
    { "date": "2024-04-04", "revenue": 1200000 },
    { "date": "2024-04-05", "revenue": 980000 }
  ]
}
```

---

## AI `/ai`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/ai/recommend/:productId` | ❌ | Sản phẩm gợi ý từ product hiện tại |
| POST | `/ai/sentiment` | ✅ Admin | Classify sentiment của text (test/manual); luồng feedback thật có thể gọi AI **nội bộ** sau `POST /feedbacks` |
| POST | `/ai/description` | ✅ Admin | Generate mô tả sản phẩm |
| POST | `/ai/advisor` | ✅ Admin | Business advisor dựa trên data |

**GET /ai/recommend/:productId**
```json
// Response
{
  "recommendations": [
    { "id": 2, "name": "...", "price": 199000, "imageUrl": "...", "reason": "Same category" }
  ]
}
```
> `:productId` là **Int** (vd. `5`).

**POST /ai/sentiment**
```json
// Request
{ "text": "Sản phẩm rất tệ, giao hàng chậm" }

// Response
{ "sentiment": "NEGATIVE", "confidence": 0.92 }
```

**POST /ai/description**
```json
// Request
{ "name": "Áo thun nam basic", "category": "Thời trang", "keywords": ["cotton", "thoáng mát"] }

// Response
{ "description": "Áo thun nam basic chất liệu cotton 100%..." }
```

**POST /ai/advisor**
```json
// Request
{
  "summary": { "totalRevenue": 15000000, "totalOrders": 120 },
  "topProducts": [...],
  "question": "Sản phẩm nào nên nhập thêm hàng?"
}

// Response
{ "advice": "Dựa trên dữ liệu, sản phẩm X đang bán chạy nhất..." }
```

---

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad Request — sai input |
| 401 | Unauthorized — chưa login hoặc token hết hạn |
| 403 | Forbidden — không đủ quyền |
| 404 | Not Found |
| 409 | Conflict — email đã tồn tại, v.v. |
| 422 | Unprocessable — vi phạm business rule (cancel order đã confirm) |
| 500 | Internal Server Error |

---

## Tham chiếu chéo

| Tài liệu | Nội dung |
|----------|----------|
| `contexts/codebase_index.md` | Tech stack, Prisma tóm tắt, route Angular, env |
| `backend/prisma/schema.prisma` | Model, enum, index — **chuẩn dữ liệu** |