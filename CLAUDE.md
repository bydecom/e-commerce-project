# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

- **Frontend:** Angular 17 (standalone components, signals, SSR via `@angular/ssr`), SCSS, Tailwind CSS, TypeScript strict
- **Backend:** Node.js 20, Express 5, TypeScript, Prisma ORM, PostgreSQL (`Int` PKs everywhere — no UUIDs)
- **Auth:** JWT access token (Bearer, in-memory only on client) + refresh token (HttpOnly cookie, stored hashed in Redis)
- **AI:** Google Gemini (`@google/genai`) + Qdrant vector DB for semantic product search
- **Email:** Nodemailer → Mailpit (dev)
- **Cache / state:** Redis (JWT blacklist, token storage, product cache, checkout stock reservations)
- **Object Storage:** MinIO (local dev, S3-compatible) → AWS S3 (production). SDK: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- **Message Broker:** RabbitMQ (AMQP via `amqplib`). Config: `backend/src/config/rabbitmq.ts`
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
Copy `backend/.env.example` to `backend/.env` and fill in secrets.

**Frontend environments:**
- `frontend/src/environments/environment.ts` — dev config (`apiUrl` → `http://localhost:3000`, `storageUrl` → `http://127.0.0.1:9002`)
- `frontend/src/environments/environment.prod.ts` — production config (`apiUrl` → your API domain, `storageUrl` → your S3/CDN domain)

**Required services (local dev):** PostgreSQL, Redis, Mailpit, MinIO. Optional: Qdrant (for AI vector search), RabbitMQ, VNPay sandbox credentials.

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

### Object Storage (MinIO / S3)

The project uses an **S3-compatible presigned-URL upload flow**:

1. **Config:** `backend/src/config/storage.ts` — creates an `S3Client` using `@aws-sdk/client-s3`.
   - In **local dev**, `AWS_ENDPOINT` points to MinIO (`http://localhost:9002`), and `forcePathStyle` is enabled automatically.
   - In **production**, omit `AWS_ENDPOINT` so the SDK uses real AWS S3 endpoints.
2. **Upload module:** `backend/src/modules/upload/` — admin-only presigned URL generation.
   - `GET /api/upload/presigned-url?mimeType=image/jpeg&ext=jpg` → returns `{ uploadUrl, publicUrl }`.
   - The frontend PUTs the file directly to the `uploadUrl` (MinIO or S3); `publicUrl` is saved in the DB.
3. **Frontend service:** `frontend/src/app/core/services/upload.service.ts` — wraps the two-step flow.
4. **Docker:** The `minio` + `minio-create-bucket` services in `docker-compose.yml` auto-create the `ecommerce-products` bucket with public download access.

**Key env vars for storage:**
```env
AWS_ENDPOINT=http://localhost:9002    # MinIO (omit for real AWS)
AWS_ACCESS_KEY_ID=admin
AWS_SECRET_ACCESS_KEY=password123
AWS_BUCKET_NAME=ecommerce-products
AWS_REGION=us-east-1
```

### HTTPS Configuration

The backend supports **optional HTTPS** via env vars. This is useful for local/staging; in production you typically terminate TLS at a reverse proxy (Nginx / Traefik / ALB).

- `HTTPS_ENABLED=true|false` — when true, Node listens on `HTTPS_PORT` using certs from `TLS_KEY_PATH` / `TLS_CERT_PATH`.
- `HTTPS_REDIRECT=true` — spins up an HTTP redirect server on `PORT` that 301s all traffic to the HTTPS port.
- `TRUST_PROXY=true` — set when behind a reverse proxy so `req.protocol`, `req.ip`, and secure cookies work correctly.
- The `isSecure()` helper in `auth.controller.ts` checks both `NODE_ENV=production` and `HTTPS_ENABLED=true` to decide cookie `secure` flag.

**For local dev:** Set `HTTPS_ENABLED=false` in `.env` to use plain HTTP on port 3000. Frontend `environment.ts` should use `http://localhost:3000`.

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
    services/        # AuthService, CartService, UploadService, product-api, order-api, …
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
- `UploadService` handles presigned-URL image uploads to MinIO/S3.
- API base URL via `environment.apiUrl`; all paths prefixed `/api` (e.g. `${environment.apiUrl}/api/products`).
- `environment.storageUrl` holds the MinIO/S3 base URL for image display.
- All heavy feature subtrees lazy-loaded; `/admin` guarded by both `authGuard` and `adminGuard`.

### AI / Vector search
- Gemini embedding model (`gemini-embedding-001`, 768-dim, L2-normalized) → Qdrant collection `products`.
- `backend/src/modules/ai/` sub-services: `chat-orchestrator` (user chatbot), `admin-chat-orchestrator`, `feedback-analyzer`, `product-description-enhancer`, `mini-advice` (daily dashboard insight).
- Provider abstraction in `ai/providers/` (Gemini + local fallback); factory in `ai.factory.ts`.
- Vector sync script: `backend/src/scripts/sync-qdrant.ts`.

### Message Broker (RabbitMQ)
- Config: `backend/src/config/rabbitmq.ts` — lazy-connect pattern with `ensureRabbitConnected()`.
- `publishEvent()` helper publishes JSON payloads to topic exchanges.
- Requires `RABBITMQ_URL` env var (e.g. `amqp://admin:secret123@localhost:5672`).
- Docker service runs RabbitMQ 3 with management UI on port `15672`.

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
- `backend/src/config/storage.ts` — S3/MinIO client configuration
- `backend/src/modules/upload/` — presigned URL upload module
- `backend/src/utils/response.ts` — `success()` / `failure()` helpers
- `backend/src/middlewares/auth.middleware.ts` — `authMiddleware`, `optionalAuthMiddleware`
- `backend/index.ts` — HTTP/HTTPS server bootstrap logic
