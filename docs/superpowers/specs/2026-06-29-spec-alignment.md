# SaveBites — Spec Alignment (v3)

**Status:** Living document.
**Purpose:** Reconcile `2026-06-17-savebites-v3-production-design.md`
(spec) with the actual code on `main`. Each section notes where
implementation diverges from the spec and whether the divergence is
intentional or backlog.

---

## How to use this document

1. When adding a feature, check this doc to avoid re-introducing
   divergence that's already been deliberated.
2. When the spec and code disagree, **code wins** for behavior; the
   spec is updated here to match.
3. Anything flagged **TODO** should be raised as a follow-up issue.

---

## 1. Routes

### 1.1 Consumer (`/c/*`)

| Spec says           | Code has                          | Notes                                       |
|---------------------|-----------------------------------|---------------------------------------------|
| `/c/discover`       | `/c/discover`                     | Map + list, filters, live stock             |
| `/c/listing/[id]`   | `/c/listing/[id]`                 | Includes booking island for quantity select |
| `/c/checkout/[orderId]` | `/c/checkout/[orderId]`        | Midtrans Snap integration                   |
| `/c/orders`         | `/c/orders`, `/c/orders/[id]`     | Detail page added for QR + countdown        |
| —                   | `/c/reviews`, `/c/reviews/[orderId]` | **Added.** Spec did not mention.    |

### 1.2 Merchant (`/m/*`)

| Spec says          | Code has                          | Notes                                       |
|--------------------|-----------------------------------|---------------------------------------------|
| `/m/dashboard`     | `/m/dashboard`                    | Today's revenue, orders by status           |
| `/m/listings/new`  | `/m/listings/new`                 | Single listing form                         |
| `/m/pickup`        | `/m/pickup`                       | QR scanner + manual pickup-code entry       |
| —                  | `/m/listings`                     | **Added.** Spec implies inline in dashboard |
| —                  | `/m/orders`                       | **Added.** Spec implies inline in dashboard |
| —                  | `/m/onboarding`                   | **Added.** Spec mentioned `/onboarding` but merchant onboarding is gated by role; this is the route |

### 1.3 Auth (`/auth/*`)

| Spec says               | Code has                            | Notes                                       |
|-------------------------|-------------------------------------|---------------------------------------------|
| `/login`, `/register`   | `/auth/login`, `/auth/register`     | **Auth prefix added** to avoid clashing with Next's reserved segments |
| `/register/merchant`    | `/auth/register?role=merchant`      | Single register form with role selector     |
| `/onboarding`          | `/m/onboarding`                     | Merchant-only                              |
| —                       | `/auth/forgot-password`, `/auth/reset-password` | **Added.** Spec omitted |

### 1.4 API Routes

Spec envisioned a tRPC endpoint. **We deliberately chose REST route
handlers** under `app/api/*` for these reasons:

- Next.js 15 App Router route handlers are server-native, no
  client/server split to maintain.
- The spec's `POST /api/trpc/[trpc]` would have required bundling
  trpc-client for the SPA-only pages.
- Public APIs (Midtrans webhook) and private mutations both fit
  cleanly under REST.

Live stock updates use **polling** (`/api/listings?ids=...`) every
30s on the discover and listing-detail pages. Spec mentioned SSE; SSE
is **TODO** (Step 8 backlog).

---

## 2. Data Model

### 2.1 Prisma vs Postgres DDL

Spec used Prisma. **We use raw SQL migrations** (`supabase/migrations/`).
Reason: Supabase RLS policies and triggers are written in SQL; keeping
schema and policies in the same file simplifies audit. A Prisma layer
on top would just add a step.

### 2.2 Tables (current)

- `profiles` — auto-created by `on_auth_user_created` trigger
- `merchants` — separate from profiles; `user_id` is the FK
- `listings` — single source of truth
- `orders` — `status`, `payment_status`, `reserved_until`
- `order_items` (folded into orders for v3) — single-line orders only
- `payments` — one row per Midtrans charge
- `ledger_entries` — append-only money log
- `reviews` — `unique(merchant_id, consumer_id)` — one review per pair
- `error_logs` — application-level errors with context

### 2.3 What changed from spec

- **`orders.id` is UUID** (spec was indifferent).
- **`listings.dietary_tags text[]`** instead of separate join table.
- **No `merchant_payouts` table** — payouts are recorded in
  `ledger_entries` with `kind = 'gross'/'fee'/'refund'`.
- **No `users` table** — Supabase `auth.users` is the source of truth;
  `profiles` holds our app-level fields.

---

## 3. Money Flow

Spec section 8 is **authoritative**. Implemented exactly:

- Fee is **3000 IDR flat** per order, not percentage.
- Fee is collected on every successful charge.
- Settlement happens via the cron job `/api/cron/payouts`.
- Refunds re-credit via Midtrans and write a negative ledger entry.

The duplicate-charge leak that the audit flagged (Step 2 fix) is
documented in `2026-06-29-audit-findings.md`.

---

## 4. Authentication

Spec section 10. Implemented with Supabase Auth:

- Cookie-based session via `@supabase/ssr` (server + client + middleware).
- Middleware redirects unauthenticated `/c/*` and `/m/*` traffic to
  `/auth/login`.
- `/m/*` further requires `profiles.role = 'merchant'`. **TODO:**
  middleware does not currently enforce role-level redirect (a
  consumer who hits `/m/dashboard` is blocked at the page level by a
  server-side check, but middleware redirect would be cleaner).

---

## 5. Observability

| Spec says          | Code has                            | Notes                                       |
|--------------------|-------------------------------------|---------------------------------------------|
| Structured logs    | `lib/utils/logger.ts`               | JSON format, context-rich                   |
| Error tracking     | `error_logs` table + `lib/utils/error-logger.ts` | Server-side errors funnel to table; client errors can be reported via `/api/error-logs` route |
| Alerts             | **TODO**                            | Not implemented in v3; deferred to prod cut-over |
| Admin dashboard    | **TODO**                            | Out of v3 scope                             |

---

## 6. Testing Strategy

| Layer              | Tool            | Status                           |
|--------------------|-----------------|----------------------------------|
| Unit               | Vitest          | ✅ 68 tests passing              |
| Integration        | Vitest + Supabase test client | ✅ 5 tests passing |
| E2E                | Playwright      | ⏳ Step 6 in progress            |
| Type check         | `tsc --noEmit`  | ✅ Clean                         |
| Lint               | ESLint 9        | ⚠️ Rushstack patch incompatibility — lint disabled for now, will revisit on ESLint 10 |

---

## 7. Open Items (TODO)

1. **SSE for live stock** — currently polling.
2. **Alerts** — error_logs has `severity` but no notification path.
3. **Admin dashboard** — out of scope for v3.
4. **Merchant role enforcement in middleware** — page-level check works but middleware-level would be cleaner.
5. **i18n polish** — most UI is Indonesian, but error messages
   inconsistently mix English. Single pass needed (Step 8).

---

## 8. How to update this doc

When you change a route, table, or money flow, edit the matching row.
If you're changing the spec, link the discussion in this section:

> YYYY-MM-DD: [Decision summary] — see commit `<sha>` or PR `#N`.