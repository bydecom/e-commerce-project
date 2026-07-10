# E-Commerce Platform

**Full-stack e-commerce built in ~5 weeks** — not a CRUD demo. The focus is production-shaped concerns: money paths, stock races, auth sessions, async workers, and deploy/rollback on real AWS infrastructure.

Buyer storefront + admin console. Local stack via Docker Compose; production on **AWS (S3/CloudFront + EC2/PM2)**, **Neon**, **Upstash**, **Qdrant Cloud**, and **VNPay**.

---

## Why this project stands out

| Area | What was built (not just “planned”) |
|------|-------------------------------------|
| **Auth & sessions** | Email-verify-before-user-create, short-lived access JWT (in-memory on client), refresh token rotation (HttpOnly cookie, hashed in Redis), JWT `jti` blacklist on logout, OTP soft-lockout, idle timeout |
| **Inventory** | Redis checkout stock reservation + TTL cleanup with distributed lock — reduces oversell before payment confirms |
| **Orders** | Enforced status machine (`PENDING → CONFIRMED → SHIPPING → DONE`, or `PENDING → CANCELLED`), Prisma transactions, order event audit trail |
| **Payments** | VNPay sandbox create + IPN verify, signature checks, idempotency-aware handling, unit tests around the money path |
| **Async work** | RabbitMQ workers for email + AI/Qdrant sync — keep HTTP handlers off Gemini/embedding latency |
| **AI** | Provider abstraction (Gemini ↔ local fallback), tool-calling chatbots, Qdrant embeddings, async feedback/vector workers — [details](#ai-system) |
| **Storage** | Presigned MinIO/S3 uploads; production path toward S3 + CloudFront (OAC / key-based media) |
| **Runtime** | PM2 cluster, graceful shutdown, Redis-backed rate limits (stricter on auth/AI), health check for smoke/rollback |
| **Resilience** | Worker reconnect, DLQ, Lua stock idempotency, VNPay IPN idempotency, rate-limit MemoryStore fallback, CI smoke + auto-rollback — [details](#technical-deep-dive) |
| **Hardening culture** | Multi-round technical critique → implement → verify on EC2 — see [`docs/codebase-review/`](docs/codebase-review/) |

> Interview-friendly one-liner: *“In five weeks I shipped an e-commerce core with Gemini/Qdrant AI, then deliberately hardened order, payment, inventory, auth, and async workers — and documented every production punch.”*

---

## Table of contents

- [Tech stack](#tech-stack)
- [Production infrastructure](#production-infrastructure)
- [Features](#features)
- [Architecture (high level)](#architecture-high-level)
- [AI system](#ai-system)
- [Technical deep dive](#technical-deep-dive)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Database & Prisma](#database--prisma)
- [Object Storage (MinIO / AWS S3)](#object-storage-minio--aws-s3)
- [HTTPS configuration](#https-configuration)
- [Docker services](#docker-services)
- [Environment variables](#environment-variables)
- [System configuration (DB-backed)](#system-configuration-db-backed)
- [Verification checklist](#verification-checklist)
- [Further reading](#further-reading)
- [License](#license)

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Backend | Node.js 20, Express 5, TypeScript, Prisma, Redis, Nodemailer, JWT, Zod |
| Frontend | Angular 17 (standalone, signals), Tailwind CSS, SCSS, SSR-ready layout |
| Data | PostgreSQL 16 (`pg_trgm`) → Neon (prod); Redis 7 → Upstash (prod) |
| Object storage | MinIO (local) → AWS S3 (prod); `@aws-sdk/client-s3` + presigner |
| Message broker | RabbitMQ 3 (`amqplib`) |
| AI | Google Gemini (`@google/genai`) + Qdrant (local / Qdrant Cloud) |
| Payment | VNPay sandbox (create + IPN) |
| Email | Mailpit (local) → Google SMTP (prod) |
| Ops | Docker Compose, PM2 cluster, Swagger (`/api-docs`) |

---

## Production infrastructure

| Component | Service | Notes |
|-----------|---------|-------|
| Frontend | **AWS S3 + CloudFront** | Static hosting + CDN |
| Backend API + workers | **AWS EC2** | PM2: API cluster + email/AI workers |
| RabbitMQ | **Docker on EC2** | `docker-compose.prod.yml` |
| PostgreSQL | **Neon** | Serverless Postgres (`connection_limit` tuned for pooler) |
| Redis | **Upstash** | Cache, rate-limit, reservations, token state |
| Qdrant | **Qdrant Cloud** | Product embeddings / semantic search |
| Object storage | **AWS S3** | Presigned upload; CDN for media |
| Email | **Google Mail** | Production SMTP |
| Payment | **VNPay** | IPN webhook on public EC2 |

---

## Features

### Storefront (buyer)

- Browse / search products (`pg_trgm` + optional vector recommend)
- Cart (client + server sync paths), checkout with stock hold
- VNPay payment return + order tracking
- Register → email verify → login / OTP / forgot-password
- Profile, address (VN location cascade), order history + feedback after `DONE`

### Admin

- Products, categories, orders (status transitions + audit events)
- Dashboard summary + daily AI mini-advice
- Feedback / sentiment + action-plan style follow-up
- Store settings, system config (runtime knobs without redeploy)
- Presigned image upload, AI description helper, admin chatbot

### Engineering surfaces (easy to miss in a feature list)

- Response envelope: `{ success, message, data, meta }` via shared helpers
- Module layout: `route → controller → service` under `backend/src/modules/*`
- Role guards on admin APIs; Zod validation middleware
- Unit tests on critical paths: auth, order, cart, product, stock reservation, VNPay

---

## Architecture (high level)

```mermaid
flowchart LR
  Browser[Angular 17] -->|HTTPS /api| API[Express API - PM2]
  Browser -->|Presigned PUT| S3[MinIO / S3]
  API --> PG[(PostgreSQL / Neon)]
  API --> Redis[(Redis / Upstash)]
  API -->|publish| MQ[RabbitMQ]
  MQ --> EmailW[Email worker]
  MQ --> AIW[AI / Qdrant worker]
  AIW --> Gemini[Gemini]
  AIW --> Qdrant[(Qdrant)]
  API --> VNPay[VNPay sandbox]
  VNPay -->|IPN| API
```

**Order status machine (enforced in service):**

```
PENDING → CONFIRMED → SHIPPING → DONE
PENDING → CANCELLED   (only while PENDING)
```

Stock is reserved at checkout (Redis TTL) and business rules around confirm/cancel are applied in transactions — see `backend/src/modules/order` and `inventory`.

---

## AI system

AI is a first-class module (`backend/src/modules/ai/`), not a single “call Gemini” helper. Design goals: **keep HTTP fast**, **fail soft**, and **swap providers** without rewriting product code.

### Provider abstraction

```
IAIProvider.generateJson<T>()
    ├── GeminiAIProvider   (@google/genai, structured JSON schema)
    └── LocalAIProvider    (fallback when Gemini off / no key)
```

Factory (`ai.factory.ts`) reads **DB-backed** `SystemConfig` (`use_gemini`, `gemini_api_key`) with env fallback — admin can flip provider without redeploy.

### Capabilities

| Capability | Who | How it works |
|------------|-----|--------------|
| **Storefront chatbot** `POST /api/ai/chat` | Guest or logged-in (`optionalAuth`) | Orchestrator: extract **intent** → run **tools** (search products, add-to-cart, navigate, orders) → generate final reply. Greeting short-circuit avoids burning quota. |
| **Admin chatbot** `POST /api/ai/admin/chat` | Admin | Separate orchestrator with intents over dashboard: summary, revenue, orders, customers, products, alerts, order/product detail — grounded in real Prisma/dashboard queries |
| **Description enhancer** `POST /api/ai/enhance-product-description` | Admin | Copywriter prompt + JSON schema; polishes draft or writes from product name |
| **Daily mini-advice** `GET /api/ai/mini-advice` | Admin | Week-over-week stats → Gemini bullets; **heuristic fallback** if AI fails so dashboard never goes blank |
| **Feedback analysis** (async) | Internal worker | After feedback create: classify **type**, **sentiment** (`POSITIVE` / `NEUTRAL` / `NEGATIVE`), suggest **action plans** |
| **Vector search / recommend** | Sync + query | Embeddings → Qdrant; used for semantic product similarity |

### Vector pipeline (Gemini + Qdrant)

| Detail | Value |
|--------|--------|
| Embedding model | `gemini-embedding-001` |
| Dimensions | **768**, L2-normalized |
| Distance | Cosine (`products` collection) |
| Document text | name + category + price + description |
| Sync path | Product AVAILABLE create/update → RabbitMQ `ai.product.vector.sync` → **AI worker** upserts (HTTP does not wait on Gemini) |
| Ops script | `backend/src/scripts/sync-qdrant.ts` for bulk reindex |

### Chat orchestration (user)

```mermaid
sequenceDiagram
  participant UI as Angular chatbot
  participant API as POST /api/ai/chat
  participant Orch as chat-orchestrator
  participant Tools as Prisma / cart / product
  participant LLM as IAIProvider

  UI->>API: message + optional context
  API->>Orch: processUserChat(userId?, message)
  Orch->>LLM: extract intent + args
  Orch->>Tools: run tools for intent
  alt navigate / deterministic
    Orch-->>UI: reply + actions (no 2nd LLM call)
  else needs natural language
    Orch->>LLM: generate final response from tool results
    Orch-->>UI: reply + product cards / actions
  end
```

### Async AI worker (cost & latency control)

`backend/src/workers/ai.worker.ts`:

- Consumes `q.ai.tasks` (`prefetch = 1` — protect Gemini rate limits)
- Handlers: **product vector sync**, **feedback analyze**
- **Idempotent** feedback: skip if `sentiment !== PENDING`
- Manual **ACK / NACK**; failures → **DLQ** (`q.ai.tasks.dlq`, TTL 7 days, max 500 messages)
- Infinite **reconnect loop** if RabbitMQ drops

Dedicated **AI rate limiter** on `/api/ai` (stricter than global) so chat spam cannot burn the API budget.

### Frontend touchpoints

- Shared chatbot UI (storefront + admin)
- Product form: “enhance description”
- Admin dashboard: mini-advice panel
- Feedback admin: sentiment + suggested action plans after worker completes

---

## Technical deep dive

This section is what separates the repo from a tutorial shop — the parts that usually break in production.

### Auth & session model

| Piece | Implementation |
|-------|----------------|
| Register | Pending record + verify token in **Redis**; **User row created only after** email link |
| Access token | Short-lived JWT (`userId`, `role`, `jti`) — **in-memory only** on Angular (XSS cannot read from `localStorage`) |
| Refresh | HttpOnly cookie; token **hashed in Redis**; **rotation** + token-family revoke on reuse/logout |
| Logout | Blacklist access JWT `jti` until `exp` |
| Client refresh | **Single-flight** Observable so parallel 401s do not stampede `/auth/refresh` |
| Abuse | Login attempt / OTP soft-lockout, change-password attempt limits, auth-specific rate limiter |

### Inventory & checkout races

- Redis **stock reservation** at checkout with TTL (`CHECKOUT_RESERVATION_TTL_SECONDS`)
- **Lua script** for atomic reserve + **idempotency** (same hold key → success, no double-count)
- Cleanup loop under **distributed lock** (`SETNX`) so PM2 cluster does not multi-run expiry
- Cancel / fail paths **return stock**; guards against cancelling when `paymentStatus === PAID`

### Orders & money

- Status transitions enforced in `order.service` (not only UI)
- Prisma `$transaction` for multi-write paths
- `OrderEvent` audit for admin timeline
- VNPay: signed create URL, **IPN verify**, amount `Math.round` defense, **idempotent** processing (duplicate IPN / unique constraints)
- Unit tests around VNPay signature & IPN and order/stock services

### Messaging (RabbitMQ)

| Concern | Approach |
|---------|----------|
| Topology | Durable topic exchanges + queues |
| Email | Auth verify / OTP / forgot + order placed / status / completed → email worker |
| AI | Vector sync + feedback analyze → AI worker |
| Delivery | Persistent messages; manual ACK; fail → DLQ (not silent drop) |
| Ops | Prefetch tuned per worker; graceful shutdown on SIGTERM |

### Self-healing & ops

| Layer | Mechanisms |
|-------|------------|
| App | RabbitMQ worker reconnect; rate-limit **RedisStore → MemoryStore fallback**; JWT blacklist fail-open/closed trade-off documented in review docs |
| Infra | `GET /api/health` (DB ping); PM2 cluster + `wait_ready` / `kill_timeout`; pm2-logrotate |
| Deploy | CI smoke on health; **auto-rollback** path when smoke fails |
| Data | Feedback orphaned sweeper; stock reservation cleanup; Neon `connection_limit` tuned for serverless pooler |

### API & frontend conventions

- Envelope: `success()` / error middleware — never raw Prisma errors to clients
- Zod `validateBody` / `validateQuery` on routes
- Angular: standalone + signals (`AuthService.currentUser`), lazy `/admin`, `authGuard` + `adminGuard`
- Upload: two-step presigned PUT (browser → MinIO/S3), API never streams large binaries

### Test surface (critical paths)

```
backend/src/modules/
  auth/__tests__/
  order/__tests__/
  cart/__tests__/
  product/__tests__/
  inventory/__tests__/   # Lua / reservation
  payment/__tests__/     # VNPay signature + IPN
```

Deeper write-ups (rounds, battle tests, self-healing map): [`docs/codebase-review/`](docs/codebase-review/).

---

## Repository structure

```
e-commerce-project/
├── backend/
│   ├── prisma/                 # schema + seed
│   ├── src/
│   │   ├── config/             # redis, rabbitmq, storage, swagger
│   │   ├── middlewares/        # auth, role, validate, error, logger
│   │   ├── modules/            # feature modules (ai, auth, order, payment, …)
│   │   ├── workers/            # email + AI consumers
│   │   └── app.ts
│   ├── index.ts                # HTTP/HTTPS bootstrap + graceful shutdown
│   └── .env.example
├── frontend/
│   └── src/app/
│       ├── core/               # guards, interceptors, Auth/Cart/Upload services
│       ├── features/           # storefront + lazy /admin
│       └── shared/
├── contexts/                   # API contract + AI/agent context
├── docs/codebase-review/       # multi-round critique, plan-vs-reality, battle tests
├── docker-compose.yml
└── README.md
```

---

## Getting started

### Prerequisites

| Tool | Notes |
|------|-------|
| [Node.js](https://nodejs.org) | **v20+** |
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | Postgres, Redis, MinIO, Mailpit, RabbitMQ, Qdrant, … |
| [Git](https://git-scm.com) | |
| Angular CLI | optional — `npx ng` works without a global install |

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
npm install
# Windows: copy .env.example .env
# macOS / Linux: cp .env.example .env
npx prisma generate
npx prisma db push
npm run db:seed   # optional
npm run dev
```

- API: `http://localhost:3000`
- Health: `GET http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/api-docs`

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

- App: `http://localhost:4200`

---

## Database & Prisma

- Schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)
- PostgreSQL with `pg_trgm` for product title search indexes
- All IDs are **`Int` autoincrement** (no UUIDs)

**Local `DATABASE_URL`** (API on host, DB in Docker — note host port **5433**):

```env
DATABASE_URL="postgresql://admin:secret123@localhost:5433/ecommerce"
```

| Goal | Command |
|------|---------|
| Push schema (dev) | `npx prisma db push` |
| Generate client | `npx prisma generate` |
| Migration workflow | `npx prisma migrate dev --name <name>` |
| Studio | `npx prisma studio` |
| Seed | `npm run db:seed` |

---

## Object Storage (MinIO / AWS S3)

1. Admin calls `GET /api/upload/presigned-url?mimeType=image/jpeg&ext=jpg`
2. Backend returns `{ uploadUrl, publicUrl }`
3. Frontend `PUT`s the file to `uploadUrl`
4. `publicUrl` (or storage key + CDN URL in prod) is saved on the product

**Local MinIO:** API `9002`, Console `9003` (`admin` / `password123`). Bucket `ecommerce-products` is created by Compose.

```env
AWS_ENDPOINT=http://localhost:9002
AWS_ACCESS_KEY_ID=admin
AWS_SECRET_ACCESS_KEY=password123
AWS_BUCKET_NAME=ecommerce-products
AWS_REGION=us-east-1
```

**Production:** omit `AWS_ENDPOINT`; use real AWS credentials and set frontend `storageUrl` / CloudFront domain in `environment.prod.ts`.

---

## HTTPS configuration

Optional TLS in Node for local/staging. Prefer terminating TLS at a reverse proxy / ALB / CloudFront in production.

| Var | Role |
|-----|------|
| `HTTPS_ENABLED` | Start HTTPS listener |
| `HTTPS_PORT` / `TLS_*_PATH` | Certs |
| `HTTPS_REDIRECT` | HTTP → HTTPS 301 on `PORT` |
| `TRUST_PROXY` | Trust `X-Forwarded-*` behind a proxy |

Refresh-cookie `secure` follows `NODE_ENV=production` **or** `HTTPS_ENABLED=true`.

| Environment | Typical config |
|-------------|----------------|
| Local | `HTTPS_ENABLED=false`, `PORT=3000` |
| Behind proxy / AWS | `HTTPS_ENABLED=false`, `TRUST_PROXY=true` |

---

## Docker services

Apps run on the host; Compose provides infrastructure only.

| Port | Service | Credentials |
|------|---------|-------------|
| `5433` | PostgreSQL | `admin` / `secret123` (db: `ecommerce`) |
| `6380` | Redis | password: `redissecret` |
| `1025` / `8025` | Mailpit SMTP / UI | — |
| `9002` / `9003` | MinIO API / Console | `admin` / `password123` |
| `5672` / `15672` | RabbitMQ / Management | `admin` / `secret123` |
| `6333` / `6334` | Qdrant HTTP / gRPC | — |
| `5050` | pgAdmin | `admin@admin.com` / `admin` |
| `8082` | Redis Commander | — |
| `9000` | Portainer | — |

**pgAdmin:** host **`postgres`**, port `5432` (inside Docker network), db `ecommerce`.

---

## Environment variables

Copy `backend/.env.example` → `backend/.env`. Highlights:

### Core

| Var | Example |
|-----|---------|
| `DATABASE_URL` | `postgresql://admin:secret123@localhost:5433/ecommerce` |
| `REDIS_URL` | `redis://default:redissecret@localhost:6380` |
| `RABBITMQ_URL` | `amqp://admin:secret123@localhost:5672` |
| `PORT` / `CLIENT_URL` | `3000` / `http://localhost:4200` |

### Auth

| Var | Notes |
|-----|-------|
| `JWT_SECRET` | Required |
| `JWT_ACCESS_EXPIRES_IN` | e.g. `14m` |
| `REFRESH_TOKEN_TTL_SECONDS` | Refresh TTL in Redis |
| `IDLE_TIMEOUT_SECONDS` | Client idle logout |
| `LOGIN_ATTEMPT_LIMIT` | OTP soft-lockout |

### Storage / payment / AI

| Var | Notes |
|-----|-------|
| `AWS_*` / `CLOUDFRONT_URL` | MinIO locally; real S3 + CDN in prod |
| `VNP_*` | VNPay sandbox portal values |
| `GEMINI_API_KEY` | Embeddings + chat / enhance / feedback (also overridable via SystemConfig) |
| `QDRANT_URL` / `QDRANT_API_KEY` | Local `http://localhost:6333` or Qdrant Cloud |
| `CHECKOUT_RESERVATION_TTL_SECONDS` | Stock hold window (default 900) |

See [`.env.example`](backend/.env.example) for the full list.

---

## System configuration (DB-backed)

Runtime knobs live in `SystemConfig` (admin API `/api/system-config`) so many values can change **without** editing `.env`. Missing keys fall back to `process.env`, then safe defaults.

---

## Verification checklist

- [ ] `docker compose up -d` healthy
- [ ] `backend/.env` ports match Compose (PG **5433**, Redis **6380**)
- [ ] `prisma generate` + `db push` OK; `GET /api/health` → 200
- [ ] Frontend at `http://localhost:4200`
- [ ] MinIO bucket exists; admin product image upload + display works
- [ ] (Optional) Mailpit at `http://localhost:8025` shows verification mail
- [ ] (Optional) VNPay sandbox credentials set for checkout IPN

---

## Further reading

| Doc | What it is |
|-----|------------|
| [`docs/codebase-review/master_checklist.md`](docs/codebase-review/master_checklist.md) | **Living go-live checklist** (R1–R11 done + R12 backlog) — audited vs code 2026-07-10 |
| [`contexts/API_CONTRACT.MD`](contexts/API_CONTRACT.MD) | HTTP contract |
| [`contexts/CODEBASE_INDEX.MD`](contexts/CODEBASE_INDEX.MD) | Agent/onboarding index |
| [`CLAUDE.md`](CLAUDE.md) | Stack + conventions for AI assistants |
| [`docs/codebase-review/technical_critique.md`](docs/codebase-review/technical_critique.md) | Architecture critique (multi-round) |
| [`docs/codebase-review/plan_vs_reality.md`](docs/codebase-review/plan_vs_reality.md) | Checklist: plan ↔ code (historical detail) |
| [`docs/codebase-review/self_healing_assessment.md`](docs/codebase-review/self_healing_assessment.md) | Self-healing map |
| [`docs/codebase-review/battle_test_audit.md`](docs/codebase-review/battle_test_audit.md) | Floating-point, pagination, money traps |
| [`docs/codebase-review/`](docs/codebase-review/) | Full round blueprints (R9–R12) |

---

## License

ISC (see [`backend/package.json`](backend/package.json)).
