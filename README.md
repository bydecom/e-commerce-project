    # E-Commerce Platform

    A full-stack e-commerce monorepo: **Express 5 + TypeScript + Prisma** on the backend, **Angular 17** on the frontend, with **Docker Compose** for local infrastructure (PostgreSQL, Redis, MinIO, Mailpit, RabbitMQ, and admin tooling).

    ---

    ## Table of contents

    - [Tech stack](#tech-stack)
    - [Prerequisites](#prerequisites)
    - [Repository structure](#repository-structure)
    - [Getting started](#getting-started)
    - [Database & Prisma](#database--prisma)
    - [Object Storage (MinIO / AWS S3)](#object-storage-minio--aws-s3)
    - [HTTPS configuration](#https-configuration)
    - [Docker services](#docker-services)
    - [Environment variables](#environment-variables)
    - [System configuration (DB-backed)](#system-configuration-db-backed)
    - [Verification checklist](#verification-checklist)
    - [License](#license)

    ---

    ## Tech stack

    | Layer | Technologies |
    |-------|--------------|
    | Backend | Node.js 20, Express 5, TypeScript, Prisma, Redis, Nodemailer, JWT, Zod validation |
    | Frontend | Angular 17 (standalone components, signals), Tailwind CSS, SCSS |
    | Data | PostgreSQL 16 (pg_trgm), Redis 7 |
    | Object Storage | MinIO (local, S3-compatible) → AWS S3 (production). SDK: `@aws-sdk/client-s3` |
    | Message Broker | RabbitMQ 3 (AMQP via `amqplib`) |
    | AI | Google Gemini (`@google/genai`), Qdrant vector DB |
    | Payment | VNPay sandbox |
    | Dev tooling | Docker Compose, Mailpit, pgAdmin, Redis Commander, Portainer |

    ---

    ## Prerequisites

    | Tool | Notes |
    |------|-------|
    | [Node.js](https://nodejs.org) | **v20+** recommended |
    | [Docker Desktop](https://www.docker.com/products/docker-desktop) | Required for PostgreSQL, Redis, MinIO, Mailpit, RabbitMQ |
    | [Git](https://git-scm.com) | |
    | Angular CLI | `npm i -g @angular/cli@17` or use `npx ng` without a global install |

    ---

    ## Repository structure

    ### Current layout

    ```
    e-commerce-project/
    ├── backend/
    │   ├── prisma/
    │   │   ├── schema.prisma       # Prisma schema (PostgreSQL)
    │   │   └── seed.ts             # Database seeder
    │   ├── src/
    │   │   ├── config/
    │   │   │   ├── redis.ts        # Redis client (lazy-connect)
    │   │   │   ├── rabbitmq.ts     # RabbitMQ client (lazy-connect)
    │   │   │   ├── storage.ts      # S3/MinIO client config
    │   │   │   └── swagger.ts      # Swagger/OpenAPI setup
    │   │   ├── middlewares/
    │   │   │   ├── auth.middleware.ts
    │   │   │   ├── error.middleware.ts
    │   │   │   ├── logger.middleware.ts
    │   │   │   ├── role.middleware.ts
    │   │   │   └── validate.middleware.ts
    │   │   ├── modules/
    │   │   │   ├── ai/             # Gemini chatbot, embeddings, feedback analysis
    │   │   │   ├── auth/           # Register, login, JWT, OTP, forgot-password
    │   │   │   ├── cart/           # Shopping cart
    │   │   │   ├── category/
    │   │   │   ├── dashboard/      # Admin dashboard + daily insights
    │   │   │   ├── feedback/       # Product feedback + sentiment analysis
    │   │   │   ├── inventory/      # Stock reservation (checkout holds)
    │   │   │   ├── location/       # Vietnam province/district/ward API proxy
    │   │   │   ├── order/          # Order CRUD + status machine
    │   │   │   ├── payment/        # VNPay integration
    │   │   │   ├── product/        # Product CRUD + landing page
    │   │   │   ├── store-setting/  # Store branding config
    │   │   │   ├── system-config/  # Runtime config (DB-backed)
    │   │   │   ├── system-log/     # Request logging
    │   │   │   ├── upload/         # Presigned URL upload (MinIO/S3)
    │   │   │   └── user/           # User CRUD
    │   │   ├── utils/
    │   │   └── app.ts              # Express app setup (CORS, Helmet, routes)
    │   ├── index.ts                # HTTP/HTTPS server bootstrap
    │   ├── package.json
    │   └── .env.example
    ├── frontend/
    │   ├── src/
    │   │   ├── app/
    │   │   │   ├── core/           # Guards, interceptors, services
    │   │   │   ├── features/       # Feature modules (lazy-loaded)
    │   │   │   └── shared/         # Reusable components, models, pipes
    │   │   └── environments/
    │   │       ├── environment.ts       # Dev config (HTTP, MinIO on localhost)
    │   │       └── environment.prod.ts  # Prod config (HTTPS, S3/CDN)
    │   ├── angular.json
    │   └── package.json
    ├── contexts/                   # Project context / internal notes
    ├── docs/                       # Additional documentation
    ├── docker-compose.yml          # Infrastructure only (apps run on the host)
    ├── CLAUDE.md                   # AI coding assistant context
    ├── .gitignore
    └── README.md
    ```

    ---

    ## Getting started

    ### 1. Start infrastructure

    From the repository root:

    ```bash
    docker compose up -d
    ```

    This starts PostgreSQL 16, Redis 7, MinIO, Mailpit, RabbitMQ, pgAdmin, Redis Commander, Qdrant, and Portainer.

    ### 2. Backend

    ```bash
    cd backend
    npm install
    # Windows: copy .env.example .env
    # macOS / Linux: cp .env.example .env
    # Edit .env as needed (see "Environment variables" section below)
    npx prisma generate
    npx prisma db push
    npm run dev
    ```

    - API base URL: `http://localhost:3000`
    - Health check: `GET http://localhost:3000/api/health` (includes a database connectivity check)
    - Swagger UI: `http://localhost:3000/api-docs`

    ### 3. Frontend

    ```bash
    cd frontend
    npm install
    npm start
    ```

    - App URL: `http://localhost:4200`

    ---

    ## Database & Prisma

    ### Overview

    - **ORM:** Prisma (`@prisma/client`); schema: [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma).
    - **Database:** PostgreSQL, aligned with the `postgres` service in `docker-compose.yml`.
    - **Extensions:** The schema enables `postgresqlExtensions` and `pg_trgm` for GIN / `gin_trgm_ops` indexes on `Product.title_unaccent` (search-related).
    - **IDs:** Models use integer primary keys with `autoincrement()`, not UUIDs.

    See the schema file for entities (`User`, `Category`, `Product`, `Order`, `OrderItem`, `Feedback`, `FeedbackActionPlan`, `FeedbackType`, `StoreSetting`, `SystemLog`, `SystemConfig`, `PaymentTransaction`, `DashboardDailyInsight`) and enums (`Role`, `OrderStatus`, `PaymentStatus`, `SentimentLabel`, `ProductStatus`, `ActionPlanStatus`).

    ### `DATABASE_URL` (local development)

    When the API runs **on your machine** (not inside Docker), point to `localhost` with the mapped port:

    ```env
    DATABASE_URL="postgresql://admin:secret123@localhost:5433/ecommerce"
    ```

    > **Note:** Docker maps PostgreSQL to host port **5433** (not the default 5432), and Redis to **6380**.

    If you later run the backend **in** Docker on the same Compose network, use the service hostname `postgres` instead of `localhost` (and `redis` for Redis).

    ### Common Prisma commands

    | Goal | Command |
    |------|---------|
    | Apply schema to the database (dev, no migration files) | `npx prisma db push` |
    | Regenerate the Prisma Client after schema changes | `npx prisma generate` |
    | Create a versioned migration (team workflow) | `npx prisma migrate dev --name your_migration_name` |
    | Open Prisma Studio (default `http://localhost:5555`) | `npx prisma studio` |
    | Seed the database | `npm run db:seed` |

    For early development, `db push` is often enough. Switch to `migrate dev` when you need reviewable, repeatable database changes.

    ---

    ## Object Storage (MinIO / AWS S3)

    ### How it works

    The project uses a **presigned-URL upload pattern** powered by the AWS SDK (`@aws-sdk/client-s3`):

    1. **Admin requests a presigned URL** → `GET /api/upload/presigned-url?mimeType=image/jpeg&ext=jpg`
    2. **Backend generates** a time-limited PUT URL (5 min) and returns `{ uploadUrl, publicUrl }`.
    3. **Frontend PUTs the file** directly to `uploadUrl` (bypassing the backend for large files).
    4. **`publicUrl`** is saved in the DB (e.g. `Product.imageUrl`).

    ### Local development (MinIO)

    MinIO runs as a Docker container, emulating S3:

    | Port | Service |
    |------|---------|
    | `9002` | MinIO API (S3-compatible) |
    | `9003` | MinIO Console (web UI) |

    Login to MinIO Console: `admin` / `password123`

    The `minio-create-bucket` sidecar container auto-creates the `ecommerce-products` bucket with public download policy.

    **Backend `.env` for MinIO:**
    ```env
    AWS_ENDPOINT=http://localhost:9002
    AWS_ACCESS_KEY_ID=admin
    AWS_SECRET_ACCESS_KEY=password123
    AWS_BUCKET_NAME=ecommerce-products
    AWS_REGION=us-east-1
    ```

    **Frontend `environment.ts`:**
    ```ts
    storageUrl: 'http://127.0.0.1:9002'
    ```

    ### Production (AWS S3)

    - **Remove** `AWS_ENDPOINT` from `.env` (SDK defaults to real S3 endpoints).
    - Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME` to your real AWS credentials.
    - Set `storageUrl` in `environment.prod.ts` to your S3 bucket URL or CloudFront distribution.

    ---

    ## HTTPS configuration

    The backend supports **optional HTTPS** directly in Node.js. This is useful for local/staging environments. **In production, it is recommended to terminate TLS at a reverse proxy** (Nginx, Traefik, AWS ALB, CloudFront).

    ### Relevant env vars

    | Var | Description |
    |-----|-------------|
    | `HTTPS_ENABLED` | `true` to start an HTTPS server; `false` (default) for plain HTTP |
    | `HTTPS_PORT` | Port for HTTPS server (default `3443`) |
    | `TLS_KEY_PATH` | Path to private key PEM file |
    | `TLS_CERT_PATH` | Path to certificate PEM file |
    | `HTTPS_REDIRECT` | `true` to spin up an HTTP→HTTPS 301 redirect on `PORT` |
    | `TRUST_PROXY` | `true` when behind a reverse proxy (so `req.protocol`, `req.ip`, and cookie `secure` flags work correctly) |

    ### How it works

    - `backend/index.ts` reads the env vars and either starts a plain HTTP server or an HTTPS server (with optional HTTP redirect).
    - `auth.controller.ts` uses an `isSecure()` helper to decide the `secure` flag for the refresh-token cookie: true when `NODE_ENV=production` **or** `HTTPS_ENABLED=true`.

    ### Recommended config by environment

    | Environment | Config |
    |-------------|--------|
    | **Local dev** | `HTTPS_ENABLED=false`, `PORT=3000`. Frontend at `http://localhost:4200` |
    | **Staging** | `HTTPS_ENABLED=true`, provide TLS certs, or use a reverse proxy with `TRUST_PROXY=true` |
    | **Production (AWS)** | `HTTPS_ENABLED=false`, `TRUST_PROXY=true`. TLS terminated at ALB/CloudFront |

    ---

    ## Docker services

    The application processes are **not** defined in `docker-compose.yml`; only supporting services are. Port reference:

    | Port | Service | Credentials |
    |------|---------|-------------|
    | `5433` | PostgreSQL | `admin` / `secret123` (db: `ecommerce`) |
    | `6380` | Redis | password: `redissecret` |
    | `1025` | Mailpit (SMTP) | — |
    | `8025` | Mailpit (web UI) | — |
    | `9002` | MinIO API (S3-compatible) | `admin` / `password123` |
    | `9003` | MinIO Console | `admin` / `password123` |
    | `5672` | RabbitMQ (AMQP) | `admin` / `secret123` |
    | `15672` | RabbitMQ Management UI | `admin` / `secret123` |
    | `6333` | Qdrant (HTTP API) | — |
    | `6334` | Qdrant (gRPC) | — |
    | `5050` | pgAdmin | `admin@admin.com` / `admin` |
    | `8082` | Redis Commander | — |
    | `9000` | Portainer | — |

    **pgAdmin (first login):** sign in with `admin@admin.com` / `admin`, then register a server to PostgreSQL using host **`postgres`** (Docker service name), port `5432`, database `ecommerce`, user `admin`, password `secret123`.

    **Redis Commander:** preconfigured to reach Redis on the Docker network.

    **MinIO Console:** browse and manage buckets at `http://localhost:9003`.

    ---

    ## Environment variables

    Copy `backend/.env.example` to `backend/.env` and adjust values. Key groups:

    ### Core
    | Var | Example | Notes |
    |-----|---------|-------|
    | `DATABASE_URL` | `postgresql://admin:secret123@localhost:5433/ecommerce` | Host port 5433 |
    | `REDIS_URL` | `redis://default:redissecret@localhost:6380` | Host port 6380 |
    | `PORT` | `3000` | Backend HTTP port |
    | `CLIENT_URL` | `http://localhost:4200` | Used for CORS, email links |
    | `NODE_ENV` | `development` | `production` in prod |

    ### Auth / JWT
    | Var | Example | Notes |
    |-----|---------|-------|
    | `JWT_SECRET` | `your-secret-key` | |
    | `JWT_ACCESS_EXPIRES_IN` | `14m` | Access token TTL |
    | `REFRESH_TOKEN_TTL_SECONDS` | `900` | Refresh token TTL (seconds) |
    | `IDLE_TIMEOUT_SECONDS` | `900` | Auto-logout on idle |
    | `LOGIN_ATTEMPT_LIMIT` | `4` | OTP lockout threshold |

    ### Object Storage (MinIO / S3)
    | Var | Example | Notes |
    |-----|---------|-------|
    | `AWS_ENDPOINT` | `http://localhost:9002` | Omit for real AWS S3 |
    | `AWS_ACCESS_KEY_ID` | `admin` | |
    | `AWS_SECRET_ACCESS_KEY` | `password123` | |
    | `AWS_BUCKET_NAME` | `ecommerce-products` | |
    | `AWS_REGION` | `us-east-1` | |

    ### HTTPS
    | Var | Example | Notes |
    |-----|---------|-------|
    | `HTTPS_ENABLED` | `false` | Set `true` only if running TLS in Node.js |
    | `HTTPS_PORT` | `3443` | |
    | `TLS_KEY_PATH` | `path/to/key.pem` | |
    | `TLS_CERT_PATH` | `path/to/cert.pem` | |
    | `HTTPS_REDIRECT` | `false` | HTTP→HTTPS redirect |
    | `TRUST_PROXY` | `false` | Set `true` behind reverse proxy |

    ### Email / VNPay / AI
    | Var | Example |
    |-----|---------|
    | `MAIL_HOST` | `localhost` |
    | `MAIL_PORT` | `1025` |
    | `MAIL_FROM` | `no-reply@ecommerce.local` |
    | `API_BASE_URL` | `http://localhost:3000` |
    | `VNP_TMN_CODE` | `your_tmn_code` |
    | `VNP_HASH_SECRET` | `your_hash_secret` |
    | `VNP_URL` | `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html` |
    | `VNP_RETURN_URL` | `http://localhost:4200/checkout` |
    | `GEMINI_API_KEY` | `your-key` |
    | `RABBITMQ_URL` | `amqp://admin:secret123@localhost:5672` |

    ---

    ## System configuration (DB-backed)

    Admin có thể cấu hình các thông số runtime trong bảng `SystemConfig` (API admin-only: `/api/system-config`) mà **không cần sửa `.env`**.

    - **Fallback**: nếu DB chưa có key, backend sẽ fallback sang `process.env` rồi tới giá trị mặc định an toàn.
    - **Seed mặc định**: chạy SQL tại `backend/prisma/migration.sql` (idempotent nhờ `ON CONFLICT DO NOTHING`).

    ---

    ## Verification checklist

    After a fresh clone:

    - [ ] Docker Desktop is running and `docker compose up -d` completes without errors
    - [ ] `backend/.env` exists (copied from `.env.example`) with correct port mappings (PG:5433, Redis:6380)
    - [ ] `npx prisma generate` and `npx prisma db push` succeed
    - [ ] `GET http://localhost:3000/api/health` returns HTTP 200
    - [ ] Frontend is reachable at `http://localhost:4200` via `npm start`
    - [ ] MinIO Console accessible at `http://localhost:9003` and `ecommerce-products` bucket exists
    - [ ] Image upload works: admin creates product with image → file stored in MinIO → image loads in frontend

    ---

    ## License

    This project is licensed under the **ISC** License (see [`backend/package.json`](backend/package.json)).
