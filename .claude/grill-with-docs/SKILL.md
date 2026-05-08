---
name: grill-with-docs
description: Grilling session that challenges your plan against this e-commerce project's domain model (CONTEXT.md), sharpens terminology (Order, Product, Feedback, etc.), and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against the project's language and documented decisions.
---

<what-to-do>

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time, waiting for feedback on each question before continuing.

If a question can be answered by exploring the codebase, explore the codebase instead.

</what-to-do>

<supporting-info>

## Domain awareness

During codebase exploration, also look for existing documentation:

### File structure

This project uses a monorepo with `backend/` and `frontend/` directories:

```
e-commerce-project/
├── CONTEXT.md                   ← domain glossary (created lazily)
├── contexts/
│   ├── API_CONTRACT.md          ← full endpoint contract
│   ├── CODEBASE_INDEX.MD        ← codebase index
│   ├── CODEBASE_STRUCTURE.MD    ← structure overview
│   └── .cursorrules             ← project coding rules
├── docs/
│   ├── adr/                     ← architectural decisions (created lazily)
│   └── codebase-review/         ← past code reviews
├── backend/
│   ├── prisma/schema.prisma     ← DB schema (source of truth for domain models)
│   └── src/modules/             ← feature modules
└── frontend/
    └── src/app/
        ├── features/            ← feature modules
        └── shared/models/       ← TypeScript interfaces for domain shapes
```

### Key domain models (from Prisma schema)

When grilling about domain concepts, these are the established entities:

- **User** (id, email, password, name, phone, address fields, role: USER/ADMIN)
- **Category** (id, name → has many Products)
- **Product** (id, name, title_unaccent, description, price, stock, imageUrl, status: AVAILABLE/UNAVAILABLE/DRAFT)
- **Order** (id, userId, status: PENDING/CONFIRMED/SHIPPING/DONE/CANCELLED, paymentStatus, total, shippingAddress)
- **OrderItem** (orderId, productId, quantity, unitPrice)
- **Feedback** (userId, productId, orderId, typeId, rating, comment, sentiment)
- **FeedbackActionPlan** (feedbackId, title, description, status, assigneeId)
- **PaymentTransaction** (orderId, vnp_TxnRef, isSuccess, rawQuery)
- **SystemConfig** (key-value runtime config)
- **StoreSetting** (store branding: name, logo, address)

If `CONTEXT.md` or `CONTEXT-MAP.md` exists, read it. If neither exists, proceed silently — create a root `CONTEXT.md` lazily when the first term is resolved.

## During the session

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

Common fuzzy terms in this project:
- **"item"** — could mean `Product`, `OrderItem`, or `CartItem`. Clarify which.
- **"status"** — could mean `OrderStatus`, `PaymentStatus`, `ProductStatus`, or `ActionPlanStatus`. Be specific.
- **"user"** — could mean any authenticated person, or specifically a non-admin `Role.USER`. Clarify.
- **"review"** / **"feedback"** — this project uses `Feedback` with a `FeedbackType`. Don't say "review" unless that's what the user means.

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

Project-specific edge cases to probe:
- Can a user cancel an order after payment but before confirmation?
- What happens to stock when an order is cancelled? (checkout reservation vs confirmed stock)
- Can a product be deleted if it has existing orders/feedback?
- What's the feedback flow? Can a user leave feedback before order is DONE?
- How does the AI sentiment analysis interact with feedback action plans?

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

Key files to cross-reference:
- `backend/src/modules/order/order.service.ts` — order status transitions
- `backend/prisma/schema.prisma` — entity relationships and constraints
- `contexts/API_CONTRACT.md` — endpoint specifications
- `backend/src/modules/auth/auth.service.ts` — auth flow logic

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there. Don't batch these up — capture them as they happen. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md).

Don't couple `CONTEXT.md` to implementation details. Only include terms that are meaningful to domain experts.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

</supporting-info>
