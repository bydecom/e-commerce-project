# Interface Design

When the user wants to explore alternative interfaces for a chosen deepening candidate, use this parallel sub-agent pattern. Based on "Design It Twice" (Ousterhout) — your first idea is unlikely to be the best.

Uses the vocabulary in [LANGUAGE.md](LANGUAGE.md) — **module**, **interface**, **seam**, **adapter**, **leverage**.

## Process

### 1. Frame the problem space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would rely on, and which category they fall into (see [DEEPENING.md](DEEPENING.md))
- A rough illustrative code sketch to ground the constraints — not a proposal, just a way to make the constraints concrete

Show this to the user, then immediately proceed to Step 2. The user reads and thinks while the sub-agents work in parallel.

### 2. Spawn sub-agents

Spawn 3+ sub-agents in parallel using the Agent tool. Each must produce a **radically different** interface for the deepened module.

Prompt each sub-agent with a separate technical brief (file paths, coupling details, dependency category from [DEEPENING.md](DEEPENING.md), what sits behind the seam). The brief is independent of the user-facing problem-space explanation in Step 1. Give each agent a different design constraint:

- Agent 1: "Minimize the interface — aim for 1–3 entry points max. Maximise leverage per entry point."
- Agent 2: "Maximise flexibility — support many use cases and extension."
- Agent 3: "Optimise for the most common caller — make the default case trivial."
- Agent 4 (if applicable): "Design around ports & adapters for cross-seam dependencies."

Include both [LANGUAGE.md](LANGUAGE.md) vocabulary and CONTEXT.md vocabulary in the brief so each sub-agent names things consistently with the architecture language and the project's domain language.

Each sub-agent outputs:

1. Interface (types, methods, params — plus invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see [DEEPENING.md](DEEPENING.md))
5. Trade-offs — where leverage is high, where it's thin

### 3. Present and compare

Present designs sequentially so the user can absorb each one, then compare them in prose. Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not a menu.

## Project-specific interface patterns

When designing interfaces for this e-commerce project, respect these existing patterns:

### Backend module interface shape

Every module exposes its interface through three files. When redesigning, maintain this layering:

```
route.ts       → URL paths + middleware chain (authMiddleware, requireRole, validateBody)
controller.ts  → Parse request → call service → wrap in success()/httpError()
service.ts     → Business logic + Prisma queries (the deepest layer)
```

The controller is the thinnest — it should be nearly mechanical. If a controller has branching logic, that logic belongs in the service.

### Response envelope contract

All new interfaces must return through `success(data, message, meta)` for success and `httpError(status, message)` for errors. This is non-negotiable — the frontend's `ApiSuccess<T>` type depends on it.

### Auth context

Protected endpoints receive `req.auth` with `{ userId, role, jti, exp }`. The interface should never require callers to pass auth info manually — it's middleware-injected.

### Storage interface

The presigned URL pattern (backend generates URL → frontend uploads directly) is the established storage interface. New features that need file uploads should use `UploadService` rather than inventing a new flow.

### Pagination interface

List endpoints return `{ data, meta: { page, limit, total, totalPages } }`. New list interfaces must follow this shape for frontend `PaginationComponent` compatibility.
