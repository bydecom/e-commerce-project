# API Contract

**Base URL:** `http://localhost:3000/api`  
**Auth:** `Authorization: Bearer <token>` on every protected route  
**IDs:** Same as Prisma — every `id`, `userId`, `productId`, `categoryId`, `orderId` in JSON is an **integer (Int)**, not UUID.

**Response format:**
```json
{ "success": true, "message": "OK", "data": {}, "meta": null }
{ "success": false, "message": "Error message", "errors": [] }
```

> **Trạng thái triển khai (backend hiện tại):** đã có handler cho `GET /api/health`, `GET|POST|PUT|DELETE /api/products`, `GET|POST /api/categories`, `GET|PUT /api/store-settings`. Các mục **Auth**, **Users**, **Orders**, **Feedback**, **Dashboard**, **AI** bên dưới là **hợp đồng mục tiêu** — router tương ứng trong `backend/src/app.ts` có thể **chưa gắn route con** (xem `contexts/CODEBASE_INDEX.MD`).

---

## Health `/health`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | ❌ | Server + DB alive (`prisma.$queryRaw`) |

**GET /health** — `200` với `data: null`, `message` kiểu `"Server and database are running."`

---

## Auth `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register account |
| POST | `/auth/login` | ❌ | Login, returns JWT |
| POST | `/auth/logout` | ✅ User | Blacklist current token |

**POST /auth/register**
```json
// Request
{ "name": "John Doe", "email": "a@gmail.com", "password": "123456" }

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
| GET | `/users/me` | ✅ User | Current profile |
| PUT | `/users/me` | ✅ User | Update profile |

**PUT /users/me**
```json
// Request
{ "name": "New Name", "phone": "0901234567", "address": "123 ABC St" }
```

---

## Products `/products`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/products` | ❌ | Product list (filter + search + pagination) |
| GET | `/products/:id` | ❌ | Product detail |
| POST | `/products` | ❌ | Create product |
| PUT | `/products/:id` | ❌ | Update product |
| DELETE | `/products/:id` | ❌ | Delete product |

> Hiện `backend/src/modules/product/product.route.ts` **chưa** gắn `authMiddleware` / `roleMiddleware` — các method trên có thể gọi công khai trong môi trường dev (phù hợp admin FE không bắt login).

**GET /products — Query params**
```
?page=1&limit=12&search=keyword&categoryId=1&minPrice=0&maxPrice=1000&sort=price_asc|price_desc|newest&status=AVAILABLE|UNAVAILABLE|DRAFT
```
> `search` khớp `name` (contains, insensitive) hoặc `title_unaccent` (contains, sau khi normalize phía server).

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
  "status": "AVAILABLE",
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
  "categoryId": 2,
  "status": "AVAILABLE"
}
```
> `status` tùy chọn — mặc định DB là `DRAFT` nếu không gửi. Server có thể generate/update `title_unaccent` khi tạo/cập nhật (index `pg_trgm` trên `title_unaccent`).

---

## Categories `/categories`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/categories` | ❌ | List categories (có `_count.products`) |
| POST | `/categories` | ❌ | Create category |

> `backend/src/modules/category/category.route.ts` chỉ đăng ký **GET /** và **POST /** — chưa có `PUT`/`DELETE`. Middleware admin **chưa** gắn.

**GET /categories** — mỗi phần tử `data`:
```json
{
  "id": 1,
  "name": "Electronics",
  "_count": { "products": 5 }
}
```

**POST /categories**
```json
// Request
{ "name": "New Category" }

// Response 201 — cùng shape như một item GET (kèm `_count.products`, category mới thường là 0)
```

---

## Store settings `/store-settings`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/store-settings` | ❌ | Lấy cấu hình cửa hàng (tạo bản ghi mặc định nếu chưa có) |
| PUT | `/store-settings` | ✅ Bearer + role `ADMIN` (middleware có trong route; verify JWT/role có thể còn TODO) | Cập nhật cửa hàng |

**PUT /store-settings** — body (các field tùy chọn): `name`, `address`, `phone`, `email`, `logoUrl`, `description` (chuỗi hoặc `null`).

---

## Orders `/orders`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/orders` | ✅ User | Create order |
| GET | `/orders/me` | ✅ User | User order history |
| GET | `/orders/me/:id` | ✅ User | User order detail |
| PATCH | `/orders/me/:id/cancel` | ✅ User | Cancel order (only when PENDING) |
| GET | `/orders` | ✅ Admin | All orders |
| GET | `/orders/:id` | ✅ Admin | Any order detail |
| PATCH | `/orders/:id/status` | ✅ Admin | Update order status |

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
| POST | `/feedbacks` | ✅ User | Submit feedback (only when order is DONE) |
| GET | `/feedbacks` | ✅ Admin | All feedbacks |
| GET | `/feedbacks/product/:id` | ❌ | Feedbacks for one product |

**POST /feedbacks**
```json
// Request
{ "orderId": 10, "productId": 1, "rating": 5, "comment": "Great product!" }

// Response 201
{ "id": 5, "rating": 5, "comment": "...", "sentiment": "POSITIVE" }
```

> `sentiment` (`POSITIVE` | `NEUTRAL` | `NEGATIVE`) is set after save — often via internal AI; may not be returned immediately if processing is async.

---

## Dashboard `/dashboard`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard/summary` | ✅ Admin | Total revenue, orders, products |
| GET | `/dashboard/orders-by-status` | ✅ Admin | Order counts by status |
| GET | `/dashboard/top-products` | ✅ Admin | Top 5 selling products |
| GET | `/dashboard/revenue-chart` | ✅ Admin | Revenue by day (7 or 30 days) |

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
| GET | `/ai/recommend/:productId` | ❌ | Recommended products from current product |
| POST | `/ai/sentiment` | ✅ Admin | Classify sentiment of text (test/manual); real feedback flow may call AI **internally** after `POST /feedbacks` |
| POST | `/ai/description` | ✅ Admin | Generate product description |
| POST | `/ai/advisor` | ✅ Admin | Business advisor from data |

**GET /ai/recommend/:productId**
```json
// Response
{
  "recommendations": [
    { "id": 2, "name": "...", "price": 199000, "imageUrl": "...", "reason": "Same category" }
  ]
}
```
> `:productId` is **Int** (e.g. `5`).

**POST /ai/sentiment**
```json
// Request
{ "text": "Very bad product, slow shipping" }

// Response
{ "sentiment": "NEGATIVE", "confidence": 0.92 }
```

**POST /ai/description**
```json
// Request
{ "name": "Basic men's tee", "category": "Fashion", "keywords": ["cotton", "breathable"] }

// Response
{ "description": "Basic men's tee in 100% cotton..." }
```

**POST /ai/advisor**
```json
// Request
{
  "summary": { "totalRevenue": 15000000, "totalOrders": 120 },
  "topProducts": [...],
  "question": "Which products should we restock?"
}

// Response
{ "advice": "Based on the data, product X is selling the fastest..." }
```

---

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad Request — invalid input |
| 401 | Unauthorized — not logged in or token expired |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found |
| 409 | Conflict — email already exists, etc. |
| 422 | Unprocessable — business rule violation (e.g. cancel confirmed order) |
| 500 | Internal Server Error |

---

## Cross-references

| Document | Contents |
|----------|----------|
| `contexts/CODEBASE_INDEX.MD` | Tech stack, Prisma summary, Angular routes, env |
| `backend/prisma/schema.prisma` | Models, enums, indexes — **source of truth** |
