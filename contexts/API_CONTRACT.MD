# API Contract

**Base URL:** `http://localhost:3000/api`  
**Auth:** `Authorization: Bearer <token>` on every protected route  
**IDs:** Same as Prisma — every `id`, `userId`, `productId`, `categoryId`, `orderId` in JSON is an **integer (Int)**, not UUID.

**Response format:**
```json
{ "success": true, "message": "OK", "data": {}, "meta": null }
{ "success": false, "message": "Error message", "errors": [] }
```

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
| POST | `/products` | ✅ Admin | Create product |
| PUT | `/products/:id` | ✅ Admin | Update product |
| DELETE | `/products/:id` | ✅ Admin | Delete product |

**GET /products — Query params**
```
?page=1&limit=12&search=keyword&categoryId=1&minPrice=0&maxPrice=1000&sort=price_asc|price_desc|newest
```
> `search` maps to search columns (e.g. `title_unaccent` / `name` depending on implementation).

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
> Server may generate/update `titleUnaccent` on create/update (sync with `pg_trgm` index).

---

## Categories `/categories`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/categories` | ❌ | List categories |
| POST | `/categories` | ✅ Admin | Create category |
| PUT | `/categories/:id` | ✅ Admin | Update category |
| DELETE | `/categories/:id` | ✅ Admin | Delete category |

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
