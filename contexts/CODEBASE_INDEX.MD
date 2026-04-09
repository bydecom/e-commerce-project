# Codebase Index — E-Commerce Mock Project

---

## Project Overview

E-commerce web app với 2 roles: **User (buyer)** và **Admin (seller)**.  
Demo scope — 5 working days, 2 developers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17+ standalone, SCSS, TypeScript strict mode |
| Backend | Node.js 20, Express.js, Prisma ORM |
| Database | PostgreSQL 16 |
| Cache | Redis 7 (JWT blacklist on logout) |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| Email | Nodemailer + Mailpit (dev only) |
| Docs | Swagger UI at `/api-docs` (khi đã mount — hiện placeholder trong `docs/swagger.json`) |
| DevOps | Docker Desktop, docker-compose |

---

## Key Business Rules

1. **Order status flow:** `PENDING → CONFIRMED → SHIPPING → DONE`, or `PENDING → CANCELLED`
2. **Cancel rule:** User can only cancel when status is `PENDING`. Admin can cancel `PENDING` only.
3. **Feedback rule:** User can only submit feedback after order status is `DONE`, one feedback per order.
4. **Inventory:** Stock is decremented when order moves from `PENDING → CONFIRMED` (not at order creation).
5. **Auth:** JWT in Authorization header. On logout, token is blacklisted in Redis until expiry.
6. **Admin APIs:** Các endpoint **yêu cầu role `ADMIN`** (vd. `POST /products`, `PATCH /orders/:id/status`) — kiểm tra qua JWT, **không** nhầm với **route Angular** `/admin/...` (chỉ là UI).

---

## Database Models (Prisma)

**Source of truth:** `backend/prisma/schema.prisma`

- **PKs:** Tất cả `id` kiểu **`Int`** `@id @default(autoincrement())` (không dùng UUID).
- **Datasource:** PostgreSQL; bật extension **`pg_trgm`** (`previewFeatures: ["postgresqlExtensions"]`) phục vụ tìm kiếm / index GIN trên `Product.title_unaccent`.

```
User        → id, email @unique, password, name?, phone?, address?, role @default(USER)
Category    → id, name
Product     → id, name, title_unaccent?, description?, price, stock, imageUrl?, categoryId
             → @@index B-tree + GIN (gin_trgm_ops) trên title_unaccent
Order       → id, userId, status @default(PENDING), total, shippingAddress, createdAt, updatedAt
OrderItem   → id, orderId, productId, quantity, unitPrice
Feedback    → id, userId, productId, orderId @unique, rating, comment?, sentiment?
```

**Quan hệ:** `User` 1–n `Order` / `Feedback`; `Category` 1–n `Product`; `Order` 1–n `OrderItem`; `Product` 1–n `OrderItem` / `Feedback`; `Order` 1–0..1 `Feedback` (orderId unique trên `Feedback`).

Enums: `Role(USER|ADMIN)`, `OrderStatus(PENDING,CONFIRMED,SHIPPING,DONE,CANCELLED)`, `SentimentLabel(POSITIVE,NEUTRAL,NEGATIVE)` — `sentiment` trên `Feedback` optional.

---

## API Base URL

`http://localhost:3000/api`

**Chi tiết endpoint:** [`contexts/API_CONTRACT.md`](API_CONTRACT.md) (chuẩn tham chiếu). Swagger: `docs/swagger.json` (placeholder) khi generate từ server.

Key endpoints (rút gọn — xem contract đầy đủ):
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`
- `GET/POST/PUT/DELETE /products`… — public list/detail; Admin cho mutate
- `GET /users/me`, `PUT /users/me`
- `POST /orders`, `GET /orders/me`, `GET /orders/me/:id`, `PATCH /orders/me/:id/cancel`
- `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status` — Admin
- `POST /feedbacks` — body: `{ orderId, productId, rating, comment }`
- `GET /dashboard/summary` — Admin
- `POST /ai/description` — body: `{ name, category, keywords }`
- `POST /ai/sentiment` — body: `{ text }`
- `POST /ai/advisor` — body: `{ summary, topProducts, question }`
- `GET /ai/recommend/:productId` — public

---

## Backend Patterns

### Standard response (always use this):
```ts
// backend/src/utils/response.ts
success(data, message = 'OK', meta = null)
// → { success: true, message, data, meta }

// Error: throw or next(createError(status, message))
// → { success: false, message, errors }
```

### Controller pattern:
```ts
const handler = async (req, res, next) => {
  try {
    const result = await someService.doThing(req.body);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
};
```

### Prisma transaction (for order creation):
```ts
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({...});
  await tx.orderItem.createMany({...});
  // deduct stock if needed
});
```

### Auth middleware usage:
```ts
router.get('/me', authMiddleware, userController.getMe);
router.post('/products', authMiddleware, roleMiddleware('ADMIN'), productController.create);
```

---

## Frontend Patterns

### Service pattern:
```ts
@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/products`;

  getProducts(params: ProductQuery): Observable<ApiResponse<Product[]>> {
    return this.http.get<ApiResponse<Product[]>>(this.apiUrl, { params: params as any });
  }
}
```

### Component pattern (standalone + signals):
```ts
@Component({ standalone: true, imports: [...], ... })
export class ProductListComponent {
  private productService = inject(ProductService);
  products = signal<Product[]>([]);

  ngOnInit() {
    this.productService.getProducts({}).subscribe({
      next: res => this.products.set(res.data),
      error: err => console.error(err)
    });
  }
}
```

### Auth guard:
```ts
// authGuard: AuthService.isAuthenticated() → /login
// adminGuard: đăng nhập + role === 'ADMIN'
```

### Cart service:
```ts
// frontend: CartService — signals + localStorage (SSR-safe)
// Methods: add(), remove(), clear(); itemCount / subtotal computed
```

---

## Angular Routes Structure

```
/                     → HomeComponent
/login                → LoginComponent
/register             → RegisterComponent
/products             → ProductListComponent
/products/:id         → ProductDetailComponent (+ AI recommendations)
/cart                 → CartComponent
/checkout             → CheckoutComponent
/orders               → OrderListComponent (user)
/orders/:id           → OrderDetailComponent (user, cancel button if PENDING)
/profile              → ProfileComponent
/admin                → lazy loaded, adminGuard
  /admin/dashboard    → DashboardComponent (charts + AI advisor)
  /admin/products     → AdminProductListComponent
  /admin/products/new → ProductFormComponent (AI description generator)
  /admin/products/:id → ProductFormComponent (edit)
  /admin/orders       → AdminOrderListComponent
  /admin/orders/:id   → AdminOrderDetailComponent (status update)
  /admin/feedbacks    → FeedbackListComponent (sentiment badges)
```

---

## AI Features Summary

| Feature | Trigger | Where |
|---------|---------|-------|
| Product description generator | Admin clicks "Generate" in product form | `POST /ai/description` |
| Feedback sentiment classification | Sau khi lưu feedback (AI nội bộ) hoặc test qua `POST /ai/sentiment` | Xem `API_CONTRACT.md` |
| Product recommendation | Shown on product detail page | `GET /ai/recommend/:productId` |
| Business advisor | Admin types question in dashboard chatbox | `POST /ai/advisor` |

AI dùng **Google Gemini** (model cụ thể thống nhất trong team, vd. `gemini-2.5-flash` trong tech stack). Fallback im lặng nếu API lỗi.

---

## Environment Variables (backend)

```
DATABASE_URL       postgresql://admin:secret123@localhost:5432/ecommerce
REDIS_URL          redis://:redissecret@localhost:6379
JWT_SECRET         your_secret
JWT_EXPIRES_IN     7d
MAIL_HOST          localhost (mailpit)
MAIL_PORT          1025
GEMINI_API_KEY     your_key
PORT               3000
CLIENT_URL         http://localhost:4200
```

---

## Dev Services (docker-compose)

```
localhost:4200  → Angular app
localhost:3000  → Express API
localhost:3000/api-docs → Swagger UI (planned)
localhost:5050  → pgAdmin (postgres GUI)
localhost:8082  → Redis Commander
localhost:8025  → Mailpit (email UI)
localhost:9000  → Portainer (Docker UI)
```