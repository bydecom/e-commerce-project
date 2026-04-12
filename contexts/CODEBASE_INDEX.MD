# Codebase Index — E-Commerce Mock Project

> Use this file to give context to AI coding tools (Cursor, Windsurf, Copilot).
> Paste into a system prompt or keep at repo root for the AI to read.

---

## Project Overview

E-commerce web app with two roles: **User (buyer)** and **Admin (seller)**.  
Demo scope — 5 working days, 2 developers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17+ standalone, Tailwind CSS, SCSS, TypeScript strict |
| Backend | Node.js 20, **Express 5**, **TypeScript**, Prisma ORM |
| Database | PostgreSQL 16 (with `pg_trgm` extension for search) |
| Cache | Redis 7 (pending registration + verify tokens; JWT `jti` blacklist on `/auth/logout`) |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| Email | Nodemailer + Mailpit (dev only) |
| Docs | Swagger UI at `/api-docs` |
| DevOps | Docker Desktop, docker-compose (infra only — apps run on host) |

---

## Key Business Rules

1. **Order status flow:** `PENDING → CONFIRMED → SHIPPING → DONE`, or `PENDING → CANCELLED`
2. **Cancel rule:** User can only cancel when status is `PENDING`. Admin can cancel `PENDING` only.
3. **Feedback rule:** User can only submit feedback after order status is `DONE`, one feedback per order.
4. **Inventory:** Stock is decremented when order moves from `PENDING → CONFIRMED` (not at order creation).
5. **Auth:** Register sends a verification link; user is created in DB only after `GET /auth/verify-email`. Login returns a JWT (`HS256`, claims `userId`, `role`, `jti`). Protected routes use `Authorization: Bearer <token>`. **`POST /auth/logout`** blacklists the current `jti` in Redis until JWT `exp`; `authMiddleware` rejects blacklisted tokens. The client still clears `localStorage` after calling logout.
6. **Admin APIs:** Intended to require `role: ADMIN` in JWT; `roleMiddleware` is still a pass-through in code — verify `authMiddleware` + role checks on each admin route before assuming enforcement.

---

## Database Models (Prisma)

> ⚠️ All IDs are `Int` with `autoincrement()` — NOT uuid

```
User        → id(Int), email(unique), password, name?, phone?, address?, role(USER|ADMIN)
Category    → id(Int), name
Product     → id(Int), name, title_unaccent?(for search), description?, price, stock,
              imageUrl?, status(AVAILABLE|UNAVAILABLE|DRAFT), categoryId(→Category)
Order       → id(Int), userId(→User), status(OrderStatus), total, shippingAddress,
              createdAt, updatedAt
OrderItem   → id(Int), orderId(→Order), productId(→Product), quantity, unitPrice
Feedback    → id(Int), userId(→User), productId(→Product), orderId(unique,→Order),
              rating, comment?, sentiment?(POSITIVE|NEUTRAL|NEGATIVE)
```

Enums:
- `Role`: `USER`, `ADMIN`
- `OrderStatus`: `PENDING`, `CONFIRMED`, `SHIPPING`, `DONE`, `CANCELLED`
- `SentimentLabel`: `POSITIVE`, `NEUTRAL`, `NEGATIVE`
- `ProductStatus`: `AVAILABLE`, `UNAVAILABLE`, `DRAFT`

Search: `pg_trgm` extension enabled. `Product.title_unaccent` has both btree and GIN (`gin_trgm_ops`) indexes.

---

## API Base URL

`http://localhost:3000/api`

Full contract: see `contexts/API_CONTRACT.MD`

Key endpoints:
- `POST /auth/register` — starts signup (Redis pending + email); response `{ email, message }`, no JWT
- `GET /auth/verify-email?token=...` — creates user; usually redirects to `CLIENT_URL/login?verified=1|0`
- `POST /auth/resend-verification` — resend link for pending signup (`429` if throttled)
- `POST /auth/login` — returns `{ token, user }`
- `POST /auth/logout` — Bearer required; blacklists JWT until expiry
- `GET /products?page&limit&search&categoryId` — public
- `POST /orders` — body: `{ items: [{productId, quantity}], shippingAddress }`
- `PATCH /orders/:id/status` — Admin, body: `{ status }`
- `POST /feedbacks` — body: `{ orderId, productId, rating, comment }`
- `GET /dashboard/summary` — Admin
- `POST /ai/description` — body: `{ name, category, keywords }`
- `POST /ai/sentiment` — body: `{ text }`
- `POST /ai/advisor` — body: `{ summary, topProducts, question }`
- `GET /ai/recommend/:productId` — public

---

## Backend Patterns

### Standard response (always use this):
```js
// src/utils/response.js
success(data, message = 'OK', meta = null)
// → { success: true, message, data, meta }

// Error: throw or next(createError(status, message))
// → { success: false, message, errors }
```

### Controller pattern:
```js
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
```js
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create({...});
  await tx.orderItem.createMany({...});
  // deduct stock if needed
});
```

### Auth middleware usage:
```js
router.get('/me', authMiddleware, userController.getMe);
router.post('/products', authMiddleware, roleMiddleware('ADMIN'), productController.create);
```

---

## Frontend TypeScript Models

```ts
// shared/models/product.model.ts
export type ProductStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'DRAFT';
export interface Product {
  id: number;           // Int, NOT string
  name: string;
  description?: string;
  price: number;
  stock: number;
  imageUrl?: string;
  status: ProductStatus;
  categoryId: number;
  category?: Category;
}

// shared/models/order.model.ts
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DONE' | 'CANCELLED';
export interface Order {
  id: number;
  userId: number;
  status: OrderStatus;
  total: number;
  shippingAddress: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

// shared/models/user.model.ts
export type Role = 'USER' | 'ADMIN';
export interface User {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  address?: string;
  role: Role;
}

// shared/models/api-response.model.ts
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: { page: number; limit: number; total: number } | null;
}
```

---

## Angular Component Pattern

```ts
// Standalone, signals, inject(), new control flow
@Component({ standalone: true, imports: [...] })
export class ExampleComponent {
  private service = inject(SomeService);
  items = signal<Item[]>([]);

  ngOnInit() {
    this.service.getItems().subscribe({
      next: res => this.items.set(res.data),
      error: err => console.error(err)
    });
  }
}
```

Template uses `@if`, `@for`, `@empty` — NOT `*ngIf` / `*ngFor`.

### Service pattern:
```ts
@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/products`;

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
// authGuard: AuthService.isAuthenticated() (token + user in localStorage) → /login if false
// adminGuard: authenticated + role === 'ADMIN'
```

### Auth UI (frontend):
- `/register` — after submit, “check email” + resend; no auto-login until verify + login
- `/login` — reads `?verified=` / `?reason=` from backend redirect after email verification

### Cart service:
```ts
// State: BehaviorSubject<CartItem[]>
// Persists to localStorage on every mutation
// Methods: addItem(), removeItem(), clearCart(), getTotal()
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
  /admin/settings     → AdminShopSettingsComponent
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
| Feedback sentiment classification | Auto after user submits feedback | `POST /ai/sentiment` (called server-side) |
| Product recommendation | Shown on product detail page | `GET /ai/recommend/:productId` |
| Business advisor | Admin types question in dashboard chatbox | `POST /ai/advisor` |

All AI calls use **Gemini 2.5 Flash** model. Fallback silently if Gemini fails.

---

## Environment Variables (backend)

```
DATABASE_URL                  postgresql://admin:secret123@localhost:5432/ecommerce
REDIS_URL                     redis://:redissecret@localhost:6379
JWT_SECRET                    your_secret
JWT_EXPIRES_IN                7d
API_BASE_URL                  http://localhost:3000   # base for verification links in email
CLIENT_URL                    http://localhost:4200   # redirect target after verify-email
VERIFY_TOKEN_TTL_SECONDS      180                     # verification link TTL (optional)
PENDING_REGISTER_TTL_SECONDS  1800                    # pending signup TTL (optional)
MAIL_HOST                     localhost (mailpit)
MAIL_PORT                     1025
MAIL_FROM                     no-reply@...
GEMINI_API_KEY                your_key
PORT                          3000
```

---

## Dev Services (docker-compose)

```
localhost:4200  → Angular app
localhost:3000  → Express API
localhost:3000/api-docs → Swagger UI
localhost:5050  → pgAdmin (postgres GUI)
localhost:8082  → Redis Commander
localhost:8025  → Mailpit (email UI)
localhost:9000  → Portainer (Docker UI)
```