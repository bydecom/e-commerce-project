# Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Assumes the vocabulary in [LANGUAGE.md](LANGUAGE.md) — **module**, **interface**, **seam**, **adapter**.

## Dependency categories

When assessing a candidate for deepening, classify its dependencies. The category determines how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable — merge the modules and test through the new interface directly. No adapter needed.

**In this project:** Zod validation schemas (`product.schema.ts`), response helpers (`success()`, `httpError()`), utility functions, pipe transforms (`currencyVnd`, `orderStatusLabel`).

### 2. Local-substitutable

Dependencies that have local test stand-ins (PGLite for Postgres, in-memory filesystem). Deepenable if the stand-in exists. The deepened module is tested with the stand-in running in the test suite. The seam is internal; no port at the module's external interface.

**In this project:** Prisma/PostgreSQL (via PGLite or test database), Redis (via `redis-memory-server` or a test Redis instance). All backend services currently call `prisma` directly with no seam — tests must run against a real database or PGLite.

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (microservices, internal APIs). Define a **port** (interface) at the seam. The deep module owns the logic; the transport is injected as an **adapter**. Tests use an in-memory adapter. Production uses an HTTP/gRPC/queue adapter.

**In this project:** RabbitMQ event publishing (`config/rabbitmq.ts` → `publishEvent()`). Currently a single adapter (real AMQP). A second in-memory adapter would make this a real seam for testing. The MinIO/S3 upload module already has a well-placed seam — `AWS_ENDPOINT` switches the adapter between MinIO and real S3.

Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."*

### 4. True external (Mock)

Third-party services (Stripe, Twilio, etc.) you don't control. The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

**In this project:** VNPay payment gateway (`modules/payment/`), Google Gemini AI API (`modules/ai/`), Vietnam provinces API (`modules/location/`), Nodemailer/Mailpit email sending. Each of these is called directly — mocking requires intercepting at the HTTP level or injecting a port.

## Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a port unless at least two adapters are justified (typically production + test). A single-adapter seam is just indirection.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them.

### Current seam audit for this project

| Module | Seam type | Adapters | Notes |
|--------|-----------|----------|-------|
| Storage (S3/MinIO) | Real seam | 2 (MinIO dev, S3 prod) | ✅ Well-designed |
| Redis | Hypothetical | 1 (real client) | Could add in-memory adapter for tests |
| RabbitMQ | Hypothetical | 1 (real AMQP) | Could add in-memory adapter for tests |
| Prisma/PostgreSQL | No seam | 1 (direct calls) | Acceptable at current scale — use PGLite for tests |
| VNPay | No seam | 1 (direct HTTP) | Needs mock adapter for payment flow tests |
| Gemini AI | No seam | 1 (direct API) | Has internal fallback logic in `ai/providers/` — partial seam |
| Email (Nodemailer) | Partial seam | 2 (SMTP prod, Mailpit dev) | ✅ Mailpit acts as test adapter |

## Testing strategy: replace, don't layer

- Old unit tests on shallow modules become waste once tests at the deepened module's interface exist — delete them.
- Write new tests at the deepened module's interface. The **interface is the test surface**.
- Tests assert on observable outcomes through the interface, not internal state.
- Tests should survive internal refactors — they describe behaviour, not implementation. If a test has to change when the implementation changes, it's testing past the interface.

### Practical testing guidance for this project

- **Backend services:** Test through HTTP requests to Express routes (integration tests). The route → controller → service chain is the interface. Mock only true external dependencies (VNPay, Gemini).
- **Frontend services:** Test through the Angular service's public methods. Mock `HttpClient` responses.
- **Auth flows:** Test the full chain: register → verify email → login → access protected route → refresh → logout. Redis must be running (local-substitutable).
- **Order status machine:** Test transitions exhaustively through the order service interface. Invalid transitions should throw `httpError`.
