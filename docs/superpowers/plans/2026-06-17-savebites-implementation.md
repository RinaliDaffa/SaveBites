# SaveBites v2 — Implementation Plan (Static Demo)

**Date:** 2026-06-17
**Target:** Demo at 15:30 today
**Stack:** Next.js 15 App Router, Tailwind, TypeScript — no backend, no auth, no API
**Reference design:** `docs/superpowers/specs/2026-06-17-savebites-v2-static-demo-design.md`

---

## Phase 0: Tidy (5 min)

Confirm what's actually in the workspace before touching anything.

| # | Action | Verify |
|---|--------|--------|
| 0.1 | `ls app/` | Should show only `layout.tsx` and `globals.css` |
| 0.2 | `ls lib/` | Should show only `constants.ts` and possibly `utils/` |
| 0.3 | `ls components/` | Likely empty or missing |
| 0.4 | `ls lib/supabase/` | If exists, **mark for deletion** in Phase 1 |
| 0.5 | `cat middleware.ts` | If present, **mark for deletion** in Phase 1 |
| 0.6 | `grep -r "from.*supabase" app/ components/ lib/` | If any matches, **mark for deletion** in Phase 1 |

---

## Phase 1: Strip (5 min)

Delete what's not needed for the demo.

| # | Action | Why |
|---|--------|-----|
| 1.1 | Delete `middleware.ts` | No auth needed |
| 1.2 | Delete `lib/supabase/` directory (if present) | No backend |
| 1.3 | Delete `supabase/` directory (if present) | No DB |
| 1.4 | Confirm no orphan imports remain | Run `npx tsc --noEmit` after |

---

## Phase 2: Shared Components (15 min)

Build the small shared kit first — every screen uses them.

| # | Component | Notes |
|---|-----------|-------|
| 2.1 | `components/shared/Button.tsx` | Variants: `primary` (emerald-600), `secondary` (stone outline), `ghost` |
| 2.2 | `components/shared/Shell.tsx` | Optional wrapper with top nav (logo + 2 role links) |
| 2.3 | `components/shared/StaleBadge.tsx` | Pill: "Pickup closes in 2h 14m" — server-rendered from item.pickupClosesAt |
| 2.4 | `lib/utils/format.ts` | Add `discountPrice()` helper if not present |

---

## Phase 3: Consumer Screens (30 min)

| # | Screen | File | Notes |
|---|--------|------|-------|
| 3.1 | Discovery | `app/consumer/page.tsx` | Server component. Grid of `ListingCard`s from `lib/constants.ts` |
| 3.2 | ListingCard | `components/consumer/ListingCard.tsx` | Image placeholder, name, original price (struck), discounted price, distance, discount badge |
| 3.3 | DiscountBadge | `components/consumer/DiscountBadge.tsx` | "-60%" red-emerald pill |
| 3.4 | Listing Detail | `app/consumer/[id]/page.tsx` | Server component. `params.id` looks up item. Big "Reserve & Pay" button → `/consumer/ticket/[orderId]` |
| 3.5 | Order ID generation | inline in listing detail | Hardcoded: `order-${item.id}-${Date.now()}`. No real uniqueness needed |
| 3.6 | Ticket / QR | `app/consumer/ticket/[orderId]/page.tsx` | Server component shell + `<QRTicket>` client component |
| 3.7 | QRTicket | `components/consumer/QRTicket.tsx` | **'use client'**. Fake QR (8x8 grid seeded by orderId), countdown timer via `useEffect`+`setInterval` |

---

## Phase 4: Merchant Screens (25 min)

| # | Screen | File | Notes |
|---|--------|------|-------|
| 4.1 | Post Surplus | `app/merchant/post/page.tsx` | Server component shell + `<SurplusForm>` client component |
| 4.2 | SurplusForm | `components/merchant/SurplusForm.tsx` | **'use client'**. Controlled inputs: name, original price, qty, discount slider (50/60/70). On submit: console.log + success toast + reset |
| 4.3 | Order Queue | `app/merchant/orders/page.tsx` | Server component. Lists sample orders from `lib/constants.ts` |
| 4.4 | OrderRow | `components/merchant/OrderRow.tsx` | **'use client'**. Shows order summary + "Mark Picked Up" toggle (strike-through + dim) |

---

## Phase 5: Landing (10 min)

| # | Screen | File | Notes |
|---|--------|------|-------|
| 5.1 | Landing page | `app/page.tsx` | Server component. Hero with serif heading, one-line value prop, two big CTAs: "I'm hungry" → `/consumer`, "I'm a restaurant" → `/merchant/post` |
| 5.2 | Hero | `components/landing/Hero.tsx` | Pulled out for clarity |

---

## Phase 6: Verify (10 min)

| # | Check | How |
|---|-------|-----|
| 6.1 | TypeScript clean | `npx tsc --noEmit` |
| 6.2 | Lint clean | `npx next lint` (or `eslint .` per project) |
| 6.3 | Build succeeds | `npx next build` |
| 6.4 | Dev server boots | `npx next dev` — no crashes on `/`, `/consumer`, `/consumer/1`, `/consumer/ticket/order-1`, `/merchant/post`, `/merchant/orders` |
| 6.5 | Manual click-through | All 6 screens reachable, all buttons work, no console errors |

---

## Total time: ~100 min (well under the 15:30 deadline from start)

## Risk mitigations

- **Orphan imports** → Phase 0.6 grep catches them; Phase 1 deletes them.
- **Type errors** → Phase 6.1 catches before build.
- **Build failure** → Phase 6.3 catches before demo.
- **QR code library missing** → v2 design says use CSS-grid fake. Zero new deps.
- **Countdown timer** → marked client component explicitly in plan (3.7, 4.2, 4.4).

## What this plan does NOT do (deferred to v1)

- No Supabase, no auth, no RLS, no migrations
- No API routes, no server actions
- No real payments, no QRIS
- No geolocation / map view
- No persistent state across reloads
- No push notifications
- No order history beyond in-memory toggle
