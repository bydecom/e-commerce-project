# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Frontend:** Angular 17 (standalone components, signals, SSR via `@angular/ssr`), SCSS, Tailwind CSS, TypeScript strict
- **Backend:** Node.js 20, Express 5, TypeScript, Prisma ORM, PostgreSQL (`Int` PKs everywhere — no UUIDs)
- **Auth:** JWT access token (Bearer, in-memory only on client) + refresh token (HttpOnly cookie, stored hashed in Redis)
- **AI:** Google Gemini (`@google/genai`) + Qdrant vector DB for semantic product search
- **Email:** Nodemailer → Mailpit (dev)
- **Cache / state:** Redis (JWT blacklist, token storage, product cache, checkout stock reservations)
- **Payment:** VNPay sandbox

## Dev Commands

### Backend (run from `backend/`)
```
npm run dev          # nodemon + ts-node (watches .env, .ts, .json)
npm start            # ts-node (no watch)
npm run db:seed      # prisma db seed
npx prisma migrate dev   # run migrations
npx prisma studio        # GUI for the DB
```

### Frontend (run from `frontend/`)
```
npm start            # ng serve → http://localhost:4200
npm run build        # ng build
npm test             # Karma/Jasmine unit tests
ng generate component features/<name>/<name>.component   # scaffold
```

### Environment
Copy `backend/.env.example` to `backend/.env` and fill in secrets. The frontend reads `frontend/src/environments/environment.ts` (`apiUrl` defaults to `https://localhost:3443`). See `backend/.env.example` for all available keys.

**Required services (local dev):** PostgreSQL, Redis, Mailpit. Optional: Qdrant (for AI vector search), VNPay sandbox credentials.

## Architecture

### Backend module layout
Every feature lives under `backend/src/modules/<name>/`:
```
<name>.route.ts       → Express Router, path declarations
<name>.controller.ts  → validate input, call service, send response
<name>.service.ts     → business logic + Prisma queries
```

**Always use `success()` / `failure()` from `backend/src/utils/response.ts`** for the response envelope:
```ts
res.json(success(data, message, meta));
next(httpError(400, 'Bad request'));   // errors go through error middleware
```

**Never return raw Prisma errors.** Map them in `backend/src/utils/prisma-error.ts`.

### Auth flow
- **Register:** pending record + verification email via Redis → `GET /api/auth/verify-email?token=` creates the DB user.
- **Login:** returns short-lived access JWT (in-memory on client) + long-lived refresh token (HttpOnly cookie, hashed in Redis).
- **Token refresh:** `POST /api/auth/refresh` — single-flight on client to avoid stacking concurrent 401 refresh calls.
- **Logout:** `POST /api/auth/logout` blacklists the JWT `jti` in Redis until `exp`; `POST /api/auth/signout` revokes refresh cookie only (when access token lost on page reload).
- **Middleware:** `authMiddleware` (requires valid non-blacklisted Bearer JWT), `optionalAuthMiddleware` (attaches `req.auth` when present but does not 401), `requireRole('ADMIN')` for admin-only routes.

### Order status machine (enforce in `order.service.ts`)
```
PENDING → CONFIRMED → SHIPPING → DONE
PENDING → CANCELLED (user or admin only while PENDING)
```
No cancellation once CONFIRMED/SHIPPING/DONE.

### Frontend structure
```
frontend/src/app/
  core/
    guards/          # authGuard, adminGuard, checkoutGuard
    interceptors/    # auth (attaches Bearer + refresh-on-401), error
    services/        # AuthService, CartService, product-api, order-api, …
  features/
    admin/           # lazy-loaded subtree → /admin (authGuard + adminGuard)
    auth/            # login, register, verify-otp, forgot-password
    checkout/        # checkout flow + result
    home/            # landing page sections
    orders/          # user order list + detail
    products/        # product list + detail
    profile/         # profile edit, change password
  shared/
    components/      # reusable UI (navbar, footer, toast, chatbot, pagination, …)
    models/          # TypeScript interfaces for all API shapes
    pipes/           # currencyVnd, orderStatusLabel, vnpayStatus
```

**Key patterns:**
- `AuthService` exposes `currentUser` / `isAuthenticated` / `isAdmin` as readonly signals; access token held in memory only.
- `CartService` syncs cart to localStorage (SSR-safe via `isPlatformBrowser`).
- API base URL via `environment.apiUrl`; all paths prefixed `/api` (e.g. `${environment.apiUrl}/api/products`).
- All heavy feature subtrees lazy-loaded; `/admin` guarded by both `authGuard` and `adminGuard`.

### AI / Vector search
- Gemini embedding model (`gemini-embedding-001`, 768-dim, L2-normalized) → Qdrant collection `products`.
- `backend/src/modules/ai/` sub-services: `chat-orchestrator` (user chatbot), `admin-chat-orchestrator`, `feedback-analyzer`, `product-description-enhancer`, `mini-advice` (daily dashboard insight).
- Provider abstraction in `ai/providers/` (Gemini + local fallback); factory in `ai.factory.ts`.
- Vector sync script: `backend/src/scripts/sync-qdrant.ts`.

### Conventions
- All IDs are **`Int`** (autoincrement) — never UUID.
- Dates in API responses: ISO 8601.
- Code identifiers in English; inline comments may be Vietnamese.
- File names: `kebab-case` everywhere; model files singular (`user.model.ts`).
- No NgRx — services + signals only.
- Avoid `any`; use `unknown` + narrowing.
- No business logic in route files.

## Key Reference Files
- `contexts/API_CONTRACT.md` — full endpoint contract
- `contexts/.cursorrules` — project coding rules
- `backend/prisma/schema.prisma` — DB models, enums, indexes (source of truth)
- `backend/src/utils/response.ts` — `success()` / `failure()` helpers
- `backend/src/middlewares/auth.middleware.ts` — `authMiddleware`, `optionalAuthMiddleware`
