# E-Commerce Platform

A full-stack e-commerce monorepo: **Express + TypeScript + Prisma** on the backend, **Angular 17** on the frontend, with **Docker Compose** for local infrastructure (PostgreSQL, Redis, Mailpit, and admin tooling).

---

## Table of contents

- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Database & Prisma](#database--prisma)
- [Docker services](#docker-services)
- [Environment variables](#environment-variables)
- [Verification checklist](#verification-checklist)
- [License](#license)

---

## Tech stack

| Layer | Technologies |
|-------|----------------|
| Backend | Node.js, Express 5, TypeScript, Prisma, Redis client (planned), Nodemailer, JWT (planned) |
| Frontend | Angular 17, Tailwind CSS, SCSS |
| Data | PostgreSQL 16, Redis 7 |
| Dev tooling | Docker Compose, Mailpit, pgAdmin, Redis Commander, Portainer |

---

## Prerequisites

| Tool | Notes |
|------|--------|
| [Node.js](https://nodejs.org) | **v20+** recommended |
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | Required for PostgreSQL, Redis, and Mailpit |
| [Git](https://git-scm.com) | |
| Angular CLI | `npm i -g @angular/cli@17` or use `npx ng` without a global install |

---

## Repository structure

### Current layout

```
e-commerce-project/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Prisma schema (PostgreSQL)
│   ├── index.ts                # Express entry & health check
│   ├── package.json
│   ├── .env.example
│   └── .env                    # Local only — copy from .env.example (not committed)
├── frontend/                   # Angular 17 + Tailwind
│   ├── src/app/
│   ├── angular.json
│   └── package.json
├── contexts/                   # Project context / internal notes
├── docs/                       # Additional documentation
├── docker-compose.yml          # Infrastructure only (apps run on the host)
├── .gitignore
└── README.md
```

### Target architecture (recommended as the project grows)

**Backend** — modular layout:

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                
├── src/
│   ├── config/
│   ├── middlewares/
│   ├── modules/
│   │   ├── auth/
│   │   ├── user/
│   │   ├── product/
│   │   ├── order/
│   │   ├── category/
│   │   ├── feedback/
│   │   └── ai/
│   ├── utils/
│   └── app.ts
├── index.ts
└── package.json
```

**Frontend** — feature-based with `core` and `shared`:

```
frontend/src/app/
├── core/
├── features/
│   ├── auth/
│   ├── products/
│   ├── cart/
│   ├── orders/
│   ├── profile/
│   └── admin/
├── shared/
├── app.routes.ts
└── app.config.ts
```

---

## Getting started

### 1. Start infrastructure

From the repository root:

```bash
docker compose up -d
```

This starts PostgreSQL 16, Redis 7 (password-protected), Mailpit, pgAdmin, Redis Commander, and Portainer.

### 2. Backend

```bash
cd backend
npm install
# Windows: copy .env.example .env
# macOS / Linux: cp .env.example .env
# Edit .env as needed (DATABASE_URL, REDIS_URL, JWT_SECRET, GEMINI_API_KEY, …)
npx prisma generate
npx prisma db push
npm run dev
```

- API base URL: `http://localhost:3000`
- Health check: `GET http://localhost:3000/api/health` (includes a database connectivity check)

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

See the schema file for entities (`User`, `Category`, `Product`, `Order`, `OrderItem`, `Feedback`) and enums (`Role`, `OrderStatus`, `SentimentLabel`).

### `DATABASE_URL` (local development)

When the API runs **on your machine** (not inside Docker), point to `localhost`:

```env
DATABASE_URL="postgresql://admin:secret123@localhost:5432/ecommerce"
```

If you later run the backend **in** Docker on the same Compose network, use the service hostname `postgres` instead of `localhost` (and `redis` for Redis).

### Common Prisma commands

| Goal | Command |
|------|---------|
| Apply schema to the database (dev, no migration files) | `npx prisma db push` |
| Regenerate the Prisma Client after schema changes | `npx prisma generate` |
| Create a versioned migration (team workflow) | `npx prisma migrate dev --name your_migration_name` |
| Open Prisma Studio (default `http://localhost:5555`) | `npx prisma studio` |

For early development, `db push` is often enough. Switch to `migrate dev` when you need reviewable, repeatable database changes.

---

## Docker services

The application processes are **not** defined in `docker-compose.yml`; only supporting services are. Port reference:

| Port | Service |
|------|---------|
| `5432` | PostgreSQL |
| `6379` | Redis |
| `1025` | Mailpit (SMTP) |
| `8025` | Mailpit (web UI) |
| `5050` | pgAdmin |
| `8082` | Redis Commander |
| `9000` | Portainer |

**pgAdmin (first login):** sign in with `admin@admin.com` / `admin`, then register a server to PostgreSQL using host **`postgres`** (Docker service name), port `5432`, database `ecommerce`, user `admin`, password `secret123`.

**Redis Commander:** preconfigured to reach Redis on the Docker network.

---

## Environment variables

Copy `backend/.env.example` to `backend/.env` and adjust values. Typical keys:

`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `MAIL_HOST`, `MAIL_PORT`, `GEMINI_API_KEY`, `PORT`, `CLIENT_URL`.

---

## Verification checklist

After a fresh clone:

- [ ] Docker Desktop is running and `docker compose up -d` completes without errors
- [ ] `backend/.env` exists (copied from `.env.example`)
- [ ] `npx prisma generate` and `npx prisma db push` succeed
- [ ] `GET /api/health` returns HTTP 200
- [ ] Frontend is reachable at `http://localhost:4200` via `npm start`

---

## License

This project is licensed under the **ISC** License (see [`backend/package.json`](backend/package.json)).
