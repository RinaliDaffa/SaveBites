# SaveBites v3 — Audit Findings

**Status:** Open punch list. Triage and tick items as you fix them.
**Date:** 2026-06-29
**Scope:** Codebase state vs the v3 production design spec (`2026-06-17-savebites-v3-production-design.md`).
**Method:** Read of all migrations, the payment surface (webhook / create / midtrans client), order reserve, pickup verify, pickup confirm, merchant listings, onboarding, registration, landing, middleware. Ran `tsc --noEmit`, `next build`, `next lint`, and `vitest run`.

---

## Verdict

Not finished. Not deployable. The architecture (DB schema, RLS, atomic reservation RPC, idempotent payment confirmation RPC, rate limiting, security headers, central validations) is genuinely well-designed. But the production build is broken, the webhook never confirms payments, the merchant scanner filters on the wrong column, several spec invariants are not enforced, and most of the spec's stated integrations (tRPC, Prisma, Redis, BullMQ, Vercel Cron, Twilio, Resend, Sentry, Leaflet, @zxing, pg_trgm) are not in the dependency tree or not wired.

Estimated remaining work: 2–4 weeks of focused implementation before "ship to a friendly cohort" is a defensible claim.

---

## Severity legend

| Tier | Meaning |
|------|---------|
| **P0** | Production-blocker. Build is broken, money flow is broken, or a security hole lets an attacker forge a payment. |
| **P1** | Significant gap. A core spec invariant is violated or a major user flow is missing. App works in a degraded way without it. |
| **P2** | Quality / consistency / DX. Should be fixed before a polished launch. |
| **P3** | Nice-to-have / future work. Already documented as out-of-scope in spec or backlog item. |

---

## Findings (severity-ordered)

### P0-1. Production build is broken

`npm run build` fails with 4 Turbopack errors in `app/api/payments/webhook/route.ts`:

- Lines 74, 77, 80: reassigning a `const`-declared `mappedPaymentStatus`.
- Line 94: re-declaring `mappedPaymentStatus` in the same scope as the first declaration on line 71.

Whoever wrote this left the first `const` block and re-declared a new one. Webhook never compiles, so the payment flow never works in production. `npm run dev` may work locally (Turbopack dev is more permissive), so this is easy to miss in development.

### P0-2. Midtrans webhook signature uses the wrong formula

`lib/midtrans/client.ts:84-88` hashes:

```
sha512(orderId + statusCode + transactionId + grossAmount + serverKey)
```

This is the **Snap** signature formula. The webhook payload corresponds to a **Core API** charge (the route calls `getCoreApiClient().createTransaction`). The Core API formula includes `gross_amount` and `signature_key` differently.

Compounded by P0-1, an attacker can forge webhook calls and flip any order to `paid`, which then unlocks a pickup QR. This is a payment-spoofing risk.

Additionally, line 37 of `app/api/payments/webhook/route.ts` wraps the verification in `if (signature)` — if Midtrans sends no signature header, the route silently processes the payload anyway. That must be a hard requirement, not a soft check.

### P0-3. Merchant pickup routes filter on the wrong column

Both routes join `orders.merchant_id` directly to `user.id` (the profile id):

- `app/api/orders/verify-pickup/route.ts:72` — `.eq('merchant_id', user.id)`
- `app/api/orders/[id]/pick-up/route.ts:78` — `.eq('merchant_id', user.id)`

But `merchants.owner_id` references `profiles.id` (which equals `auth.uid()`), and `orders.merchant_id` references `merchants.id`. The merchant scans cannot find any order.

The correct filter is either:

```ts
.eq('merchant_id', merchantRow.id)   // resolved via subquery on merchants.owner_id
```

…or use the existing `mark_order_picked_up(p_pickup_code text)` RPC from migration 0001, which already validates merchant ownership correctly.

### P0-4. Onboarding form action is type-incompatible

`app/m/onboarding/page.tsx:50` passes `createMerchantAction` directly to `<form action={...}>`. The form-action signature requires `(formData) => void | Promise<void>`. `lib/actions/merchants.ts` returns `{ success: boolean; error?: string }`. TypeScript reports `TS2322` and Next.js will throw at runtime trying to serialize the return value as a redirect. Merchant onboarding is broken.

The fix is one of:

- Change `createMerchantAction` to return `void` and use `redirect()` internally.
- Wrap the action in a client component that calls it via `useTransition` and handles the return value.

### P0-5. Webhook never calls the idempotent `confirm_payment` RPC

Migration 0002 (`supabase/migrations/00000000000002_payments_and_hardening.sql:118`) defines a beautifully idempotent `confirm_payment(...)` RPC that handles every status case (paid, settlement, capture, deny, cancel, expire, failure) with proper terminal-state checks.

The webhook route at `app/api/payments/webhook/route.ts` does **not call it**. Instead it does raw `update` on `orders` and `payments` from the same user-context client. The audit trail in `payment_webhooks` is not populated, the idempotency guarantee is not in effect, and the order's `status` advances with no DB-level guard.

### P0-6. Pickup-confirm requires `status='ready'` but the webhook only sets `status='paid'`

`app/api/orders/[id]/pick-up/route.ts:118` rejects with 400 unless `order.status === 'ready'`. The webhook (`webhook/route.ts:87`) sets `status = 'paid'`. There is no code path that ever transitions an order from `'paid'` to `'ready'`. **Even after fixing P0-3, the pickup will still fail with "Pesanan belum siap untuk pickup".**

Either the spec flow adds a `ready` transition (e.g., merchant marks meal ready, or auto-set on pickup deadline approaching), or this check should be `status === 'paid'`.

---

### P1-1. Order expiry sweeper is not wired

`expire_unpaid_orders()` is defined in migration 0002:329. Nothing calls it on a schedule.

- There is no Vercel Cron config in the repo.
- `next.config.ts` does not declare a `crons` array.
- `vercel.ts` (the new config file) does not exist.

Consequence: unpaid reservations never auto-expire, held stock never returns to the discovery feed, and the discovery feed's `quantity_available` keeps counting inventory that is conceptually reserved but abandoned. This is a revenue leak and a UX bug.

### P1-2. Reservation does not enforce the 10-minute hold

Spec §7.1: `Order.reservedUntil = NOW() + 10min`. The actual `create_order` RPC (migration 0001:216) **never sets any reserve/hold window**; it uses the listing's 2-hour window (`available_until`) as `pickup_deadline`. There is no separate `reserved_until` column.

The spec's R8 ("Reservation is atomic and time-boxed (10 minutes)") is not enforceable with the current schema. Consequence: the `expire_unpaid_orders()` function in P1-1 has no way to honor a 10-minute window — it expires on the listing's 2-hour window.

### P1-3. Phone is optional at registration

Spec R10: "Real name + phone number are mandatory at registration."

- `app/auth/register/page.tsx:141` labels phone as `(optional)`.
- The form passes it via `raw_user_meta_data->>'phone'`; the trigger copies to `profiles.phone`.
- `profiles.phone` is `text` and nullable.
- No Twilio OTP, no phone verification.

R10 is violated at both the data layer and the UX layer.

### P1-4. Money math deviates from the spec

Spec R4: Platform fee is a flat Rp 3.000 per order. R5: merchant payout = subtotal − fee.

The actual `payments` insert in `app/api/payments/create/route.ts:55` computes:

```ts
grossAmount = (itemPrice * itemQuantity) + (order.service_fee ?? 0)
```

There is no flat Rp 3.000 line. `service_fee` is whatever the order column has (it is `numeric(10,2) default 0` in the schema), so the fee is effectively 0 unless someone manually sets `service_fee = 3000` at order creation. Either the platform is undercharging or the route is misreading the column. There is no enforcement of R4 anywhere.

There is no `Settlement` table, no payout job, and no merchant ledger. The entire §8 money-flow section of the spec is unimplemented.

### P1-5. Real-time / live stock updates are missing

Spec §4 calls for SSE streams backed by Redis Pub/Sub. None of it exists:

- No `app/api/realtime/` route.
- No Redis client in the dep tree (only `@upstash/redis` in devDependencies for the rate limiter tests).
- No `listings:stock:{id}` channel.
- The Supabase Realtime publication is enabled on `listings` (migration 0001:433), which is half the answer; no client subscription in `app/c/discover/page.tsx` or its components.

Consequence: the discovery feed shows stale stock after another consumer reserves. Two consumers may both see "1 available" and race for it. The DB-level lock saves correctness, but the UX is confusing.

### P1-6. The "force users to be merchants" UX is rough

After registration, a user who picks the merchant role is sent to `/auth/login` (per `app/auth/register/page.tsx:71`) with no role context. They have to manually navigate to `/m/onboarding`. There is no `/onboarding` route from the spec; only `/m/onboarding`.

Fix: post-signup, route merchants straight to `/m/onboarding` with a "Continue" state, and route consumers straight to `/c/discover`.

### P1-7. QR scanner will be blocked by Permissions-Policy

`middleware.ts:19` sets `Permissions-Policy: ... camera=() ...`. The merchant pickup scanner at `app/m/pickup/page.tsx` (using `@yudiel/react-qr-scanner`) requires camera access. With this header in place, the browser will refuse to expose `getUserMedia()` and the scanner will silently fail.

The fix is either:

- Remove `camera=()` from the global Permissions-Policy.
- Send a per-route override on `/m/pickup` that adds `camera=(self)`.

The former is simpler. Verify which the scanner dep needs.

### P1-8. The landing page promises up to 80% off

`app/page.tsx:79`: "Save Up to 80%".

Spec R9 locks discount to 50/60/70%. Either the marketing claim is a lie, the spec needs R9 widened, or the data model needs an 80% tier. Pick one and make them consistent. Marketing-vs-truth mismatches have legal teeth in some jurisdictions.

---

### P2-1. `npm run lint` calls `next lint`, which doesn't exist

`package.json:9` defines `"lint": "next lint"`. The `next lint` command was removed in Next.js 15.5+. This project is on Next.js 16.2.9 (`package.json:24`).

The `eslint-config-next` dependency is pinned to `15.5.2` (`package.json:47`), which is mismatched with the rest of the toolchain.

Fix: replace with `"lint": "eslint ."` and pin `eslint-config-next` to `^16`.

### P2-2. Database types are not actually generated

`package.json:14` declares a `db:generate` script that runs `supabase gen types typescript --linked --schema public > lib/types/database.ts`. But:

- `lib/types/database.ts` exists but is not committed / not regenerated on CI.
- Most routes hand-cast with `as any` and `String(body.order_id ?? '')`.
- The "end-to-end types from DB to UI" promise is not delivered.

Fix: wire `db:generate` into a pre-build step and remove `as any` casts in the routes.

### P2-3. Spec-vs-implementation drift on every major page

- Spec §6.1 lists 4 consumer routes; the implementation has 6 (`/c/reviews` extra, `/c/orders/[id]` extra).
- The original spec uses a `DiscountPct` enum; the DB has `discount_total numeric` and never stores the percent.
- The "islands" naming convention (`booking-island.tsx`, `submit-review-island.tsx`, `payment-status-actions.tsx`) is consistent but undocumented.
- The spec lists tRPC v11; the implementation uses REST routes (which is fine, but the docs are wrong).

Either update the spec to match the implementation, or refactor the implementation to match the spec. The latter is the right call for a "production" project.

### P2-4. No integration tests for the business logic

Vitest covers 68 unit tests across 5 files: rate limiter, security primitives, body-limit guard, request helpers, validation schemas. **None of the business logic is tested.** No tests for:

- `create_order` (the RPC in migration 0001)
- `cancel_reservation` (the RPC in migration 0002)
- `mark_order_picked_up` (the RPC in migration 0001)
- `confirm_payment` (the RPC in migration 0002)
- The flat-fee invariant (R4)
- The 2-hour pickup-window invariant (R3)
- The 10-minute reserve-window invariant (R8) — once P1-2 is fixed

Playwright is configured (`playwright.config.ts`) but I did not find a passing E2E for the 10-step happy path the spec demands.

Spec §12 lists Vitest + pg-mem / testcontainers. Neither is in the dep tree.

### P2-5. Accessibility is partial

Good:

- Forms have `<label htmlFor>` and `required` on most inputs.
- Buttons have descriptive text.

Missing:

- No `lang` attribute on `<html>` confirmed (need to check `app/layout.tsx`).
- The landing CTA pair is two identical "Start as Consumer" / "Start as Merchant" links that go to the same `/auth/register` URL with no role context. The role selection happens below the fold.
- No skip-link, no `aria-current` on nav.
- The "Deteksi lokasi saya" button (`app/m/onboarding/page.tsx:177`) has no `aria-live` region for the geolocation result; a screen reader user gets no feedback.
- The role-toggle group at `app/auth/register/page.tsx:93` is two `<button>`s, not a `role="radiogroup"` with `aria-checked`.

### P2-6. i18n is mixed

The spec says Indonesian-only v1. The landing and onboarding pages are bilingual: English on the public marketing, Indonesian on the merchant onboarding. Login/register/auth pages are English-only. No `messages/` dir, no `next-intl`, no locale switch.

Either commit to Indonesian end-to-end, or commit to English end-to-end. The current mix is the worst of both worlds for a production launch.

### P2-7. tRPC, Prisma, Redis, BullMQ, Twilio, Resend, Sentry, Leaflet, @zxing/browser, pg_trgm — not in the dep tree

The spec lists these as the chosen stack. None are in `package.json`. Folders exist for `lib/trpc/` (a 162-line stub), `lib/queries/` (real Supabase queries), `lib/hooks/` (`useLocation` only), but the actual integrations are absent.

Either update the spec to match the chosen architecture (REST + Supabase client + manual queries), or add the missing deps and wire them.

### P2-8. No seed / admin story

There is no admin role in the spec, no admin route, no seed script. The repo's `scripts/` folder is empty (the v2 `deploy-schema.sh` was deleted). First-time setup on a fresh Supabase project requires manual SQL paste.

At minimum: a `scripts/seed.ts` that creates one merchant + one listing + one order, for local dev and Playwright fixtures.

### P2-9. Force-update step removed (mentioned by `db:push` script only)

`package.json:13` declares `"db:push": "supabase db push"` but there is no `db:reset`, no `db:diff`, no CI step. The migration story is undocumented; a new contributor has no idea how to stand up a fresh DB.

---

### P3-1. Removed scripts not in version control anymore

- `scripts/deploy-schema.sh` — deleted (per git status). Old, was for v2.
- `specs/index.md` — deleted (per git status).

These are intentional cleanups per the recent `chore: clean repo` commit. No action needed, but document the cleanup in the README so newcomers don't look for them.

### P3-2. PostGIS / 2km geo search not implemented

Spec §3 says "PostGIS 3.4, GIST index on `merchants.geom`". The actual schema uses `latitude double precision, longitude double precision` with a btree composite index (`idx_merchants_geo`). No PostGIS extension. No `ST_DWithin` query. The 2 km filter (if implemented at all) is probably a bounding-box Haversine approximation.

For an MVP in Yogyakarta (small radius, low listing count), the approximation is fine. For scale, switch to PostGIS as the spec describes.

### P3-3. SSE vs Supabase Realtime — pick one

Spec §3 says SSE. The DB has Supabase Realtime publication on `listings`. Pick one and document. Supabase Realtime is easier; SSE is what the spec describes. The current state is "neither".

### P3-4. Lighthouse / performance budget not measured

Spec §17 DoD says "Lighthouse performance score ≥ 85 on `/c/discover`". There is no Lighthouse check in CI. The hero uses large Tailwind gradients; the client island downloads are not measured. No perf budget enforcement.

### P3-5. Sentry / Axiom / Resend / Twilio / pg_trgm / Mapbox not configured

All listed as dependencies of the chosen stack. None in `package.json`. Either add them or remove them from the spec.

---

## Punch list (checklist)

Tick each box as you complete it. Each item links to a finding above for context.

### P0 — Production-blockers

- [ ] **A1.** Remove duplicate `mappedPaymentStatus` declaration in `app/api/payments/webhook/route.ts` (lines 71 + 94). Merge into one block.
- [ ] **A2.** Fix Midtrans signature formula in `lib/midtrans/client.ts:84-88` to match the Core API shape; remove the `if (signature)` short-circuit so unsigned payloads are rejected.
- [ ] **A3.** Replace `.eq('merchant_id', user.id)` with the correct ownership join in `app/api/orders/verify-pickup/route.ts:72` and `app/api/orders/[id]/pick-up/route.ts:78`. Either resolve merchant via subquery or use the `mark_order_picked_up` RPC from migration 0001.
- [ ] **A4.** Make `createMerchantAction` in `lib/actions/merchants.ts` return `void` (use `redirect()` internally), or wrap in a client component.
- [ ] **A5.** Have `app/api/payments/webhook/route.ts` call the existing `confirm_payment(...)` RPC from migration 0002 instead of doing raw `update` on `orders` and `payments`.
- [ ] **A6.** Decide whether `status='ready'` is a real transition. If yes, add the merchant action that sets it. If no, change the pickup-confirm check at `app/api/orders/[id]/pick-up/route.ts:118` to accept `status === 'paid'`.

### P1 — Significant gaps

- [ ] **B1.** Add a Vercel Cron config (either `vercel.ts` or `crons` in `next.config.ts`) that runs `expire_unpaid_orders()` every minute.
- [ ] **B2.** Add a `reserved_until` column to `orders`, set it in `create_order` to `now() + 10 minutes` per R8, and update `expire_unpaid_orders()` to expire based on that column.
- [ ] **B3.** Make phone required at registration: remove `(optional)` label, add Zod `min(1)` on `phone`, and decide whether to ship Twilio OTP now or push OTP to v1.1.
- [ ] **B4.** Enforce the Rp 3.000 flat fee (R4) in the order insert RPC; add a `Settlement` table; wire a daily payout job.
- [ ] **B5.** Wire real-time stock updates on `/c/discover` — either Supabase Realtime subscription to `listings` table or SSE per the spec.
- [ ] **B6.** After signup, route merchants directly to `/m/onboarding` and consumers directly to `/c/discover`, with role context preserved.
- [ ] **B7.** Remove `camera=()` from the global Permissions-Policy in `middleware.ts:19`, or override it on `/m/pickup`.
- [ ] **B8.** Reconcile the "80% off" marketing claim in `app/page.tsx:79` with the spec's 50/60/70% R9 enum.

### P2 — Quality / consistency

- [ ] **C1.** Replace `"lint": "next lint"` in `package.json` with `"lint": "eslint ."`; pin `eslint-config-next` to `^16`.
- [ ] **C2.** Wire `db:generate` into a pre-build step (or CI step); remove `as any` casts in route handlers.
- [ ] **C3.** Update `docs/superpowers/specs/2026-06-17-savebites-v3-production-design.md` to reflect the actual implementation (REST + Supabase client, no tRPC/Prisma), or refactor to match.
- [ ] **C4.** Add integration tests for `create_order`, `cancel_reservation`, `mark_order_picked_up`, `confirm_payment` (Vitest + pg-mem or testcontainers per spec §12). Add a Playwright E2E for the 10-step happy path.
- [ ] **C5.** Add `lang` on `<html>`, `aria-live` on the geolocation button, `role="radiogroup"` + `aria-checked` on the role toggle, and a skip-link in the layout.
- [ ] **C6.** Pick a single language for the marketing surface (Indonesian per the spec) and translate the English copy, or document the bilingual choice.
- [ ] **C7.** Decide on the missing stack pieces (tRPC, Prisma, Redis, BullMQ, Twilio, Resend, Sentry, Leaflet, @zxing, pg_trgm). Either add them or remove them from the spec.
- [ ] **C8.** Add a seed script (`scripts/seed.ts`) that creates one merchant, one listing, and one order, for local dev and Playwright fixtures.
- [ ] **C9.** Document the migration story in `README.md`: `db:push`, `db:reset`, `db:generate`, and how a new contributor stands up a fresh DB.

### P3 — Future work

- [ ] **D1.** Switch from lat/lng btree to PostGIS `geography(Point, 4326)` with a GIST index per spec §3. Acceptable to defer past v1.
- [ ] **D2.** Pick SSE or Supabase Realtime as the canonical real-time transport; remove the other from the spec.
- [ ] **D3.** Add a Lighthouse perf budget check in CI; assert ≥ 85 on `/c/discover` per spec §17 DoD.
- [ ] **D4.** Add Sentry / Axiom / Resend / Twilio / Mapbox if they remain in the spec; remove if not.

---

## Notes for whoever picks this up

- The DB migrations are the strongest part of the project. Read them before reading the routes — the routes look thin because most logic lives in the DB.
- The biggest single risk right now is P0-1 + P0-2 + P0-5 together: a broken build, a broken signature, and a webhook that doesn't use the idempotent RPC. Until all three are fixed, do not run the app in any environment that talks to real Midtrans.
- P0-3 and P0-6 are independent of the payment issues and should be fixed in the same PR — both block the merchant pickup flow.
- The flat-fee / settlement work (P1-4) is the biggest single chunk of remaining work. It needs a separate design pass before implementation, not just a code change.