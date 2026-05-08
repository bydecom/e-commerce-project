# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merged with this project's conventions.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Project-Specific Rules

**Respect this project's established patterns.**

- **Response envelope:** Always use `success()` / `failure()` from `backend/src/utils/response.ts`. Never return unwrapped data.
- **Error handling:** Never return raw Prisma errors — map via `backend/src/utils/prisma-error.ts`. Use `httpError()` from `backend/src/utils/http-error.ts`.
- **Module layout:** Every feature in `backend/src/modules/<name>/` must follow the `route → controller → service` pattern. No business logic in route files.
- **IDs:** All primary keys are `Int` (autoincrement) — never UUID.
- **Auth:** Use `authMiddleware` + `requireRole(['ADMIN'])` for admin routes. JWT payload: `{ userId, role, jti, exp }`.
- **Frontend:** Standalone components only. `inject()` over constructor DI. Signals over BehaviorSubject. No NgRx.
- **Naming:** kebab-case everywhere. Models singular (`user.model.ts`).
- **Types:** Avoid `any`; use `unknown` + narrowing.
- **Storage:** S3-compatible flow via `@aws-sdk/client-s3`. MinIO local, S3 production. Presigned URL pattern for uploads.
- **Comments:** Code identifiers in English; inline comments may be Vietnamese.

## Agent skills

### Issue tracker

This project does not currently use GitHub Issues or a formal issue tracker. Track work via local markdown in `.scratch/` if needed. See `docs/agents/issue-tracker.md` (if created).

### Domain docs

Single-context project. Domain glossary at `CONTEXT.md` (root, created lazily). ADRs at `docs/adr/` (created lazily). See `docs/agents/domain.md` (if created).

### Key reference files

- `contexts/API_CONTRACT.md` — full endpoint contract
- `contexts/.cursorrules` — project coding rules
- `contexts/CODEBASE_INDEX.MD` — codebase index
- `contexts/CODEBASE_STRUCTURE.MD` — codebase structure
- `backend/prisma/schema.prisma` — DB schema (source of truth)
- `backend/src/config/storage.ts` — S3/MinIO client
- `backend/src/utils/response.ts` — response envelope helpers
- `backend/index.ts` — HTTP/HTTPS bootstrap

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
