# SaveBites — Design Spec

**Date:** 2026-06-16
**Status:** In user review
**Project:** Self-pickup marketplace for surplus food at 50–70% discount

## 1. Problem and goal

Indonesian restaurants discard large amounts of edible surplus food every day. Discounted pickup-based resale is the obvious answer, but only if the experience is simpler than the waste. SaveBites is a self-pickup-only app: consumers find surplus food within 2 km, pay via QRIS, and pick it up at the store before the merchant's deadline. No couriers, no delivery fees — that would erase the discount.

The MVP is a single-city, single-payment-rail (Midtrans sandbox), browser-based web app built on Next.js + Supabase. Native mobile is out of scope; the merchant cashier uses the same web app on a phone.

## 2. What gets cut from the prior codebase

The previous build drifted into an unused marketplace/cart model. The following are deleted:

- `lib/types/database.ts` (replaced by `lib/types.ts` with types inferred from queries and `supabase/schema.sql`)
- Type definitions and tables for `menu_items`, `cart_lines`, `favorites`, `notifications`, `order_items`
- `OrderWithDetails`, `MerchantWithMenu`, `CartLine`, `Notification` types
- Favorites/wishlist, push notifications, in-app chat, scheduled/recurring pickups, multi-item orders

**Kept and trimmed:** `lib/format.ts` (idCurrency, percentage math, time countdown) — see section 15.

The flash-sale single-listing model stays. Each `listings` row is one surplus food offer: name, original price, discounted price, quantity, pickup deadline, merchant. A consumer reserves one or more units of that listing.

## 3. User roles and flows

### Consumer

1. **Register** at `/register` with email, password, and role = `consumer`. Optionally grant browser geolocation permission; the app works without it via city search.
2. **Discovery** at `/`. Server reads nearby active listings within 2 km, sorted by `distance ASC, deadline ASC`. Toggle between list and map view.
3. **Listing detail** at `/listing/[id]`. Shows name, photo, original price (struck through), discounted price, quantity left, merchant name and rating, distance, pickup deadline. Tapping "Bayar" starts the payment flow.
4. **Pay** redirects to Midtrans Snap. On success, status returns as `paid` and the consumer lands on `/orders/[id]`.
5. **Order detail** at `/orders/[id]`. Shows the QR ticket (encoding a URL with orderId + 6-char code), the 6-char code in plain text, the merchant's address, and a countdown to the pickup deadline.
6. **My orders** at `/orders`. Lists active, picked-up, and expired orders.
7. **Review** at `/merchants/[id]` after the order is `picked_up`. 1–5 stars and a comment (max 500 chars). One review per order, enforced by DB unique constraint.

### Merchant

1. **Register** at `/register` with role = `merchant`. On first login, redirect to `/merchant/onboarding` to enter business name, address, and category.
2. **Dashboard** at `/merchant`. Lists active surplus with name, original price, discounted price, quantity left, deadline. A "Tambah Surplus" button opens the form.
3. **Add surplus** at `/merchant/new`. Form: food name (or pick from a merchant-specific "menu" of past names), original price, quantity, discount slider (50/60/70%), pickup deadline (default = store close time).
4. **Pickup queue** at `/merchant/orders`. Two tabs: "Scan" (camera) and "Ketik kode" (text input). Both POST to the same verification endpoint.

## 4. Architecture

### Stack

- **Framework:** Next.js (App Router) with route groups `(consumer)` and `(merchant)`
- **DB / Auth / Realtime:** Supabase (Postgres, Auth, RLS)
- **Payments:** Midtrans Snap (sandbox)
- **Styling:** Tailwind + shadcn/ui primitives
- **Forms / validation:** react-hook-form + zod
- **Camera scanning:** html5-qrcode (consumer-side camera, merchant-side scanner)
- **Map:** Leaflet + OpenStreetMap tiles (free, no API key; works for the single-city MVP without billing)

### File structure

```
app/
  (auth)/
    login/page.tsx
    register/page.tsx
  (consumer)/
    layout.tsx
    page.tsx                       # /  Discovery
    listing/[id]/page.tsx
    orders/page.tsx
    orders/[id]/page.tsx
    merchants/[id]/page.tsx
  (merchant)/
    layout.tsx
    merchant/page.tsx
    merchant/new/page.tsx
    merchant/orders/page.tsx
    merchant/onboarding/page.tsx
  api/
    midtrans/webhook/route.ts
    orders/[id]/pickup/route.ts
    orders/[id]/review/route.ts

components/
  consumer/{DiscoveryList,DiscoveryMap,ListingCard,OrderCard,QrTicket,Countdown,ReviewForm,MapToggle}.tsx
  merchant/{SurplusForm,SurplusList,PickupQueue,ScanBox,CodeEntryBox}.tsx
  shared/{Header,RoleBadge,PriceBlock,DistancePill,EmptyState,ErrorState}.tsx
  ui/                              # shadcn primitives

lib/
  queries/{listings,merchant,orders,reviews}.ts
  mutations/{orders,reviews}.ts
  supabase/{client,server,admin}.ts
  auth.ts                          # getUser, requireUser, requireRole
  midtrans.ts                      # createTransaction, verifySignature
  geo.ts                           # getCoords, haversine, geocode fallback
  types.ts                         # inferred return types + generated DB types
  utils/{format,distance,id}.ts
  validators/                      # zod schemas for forms + API

supabase/
  schema.sql                       # existing
  migrations/                      # incremental reviews table + RLS

middleware.ts                      # role-based routing
```

### Route grouping rationale

`(consumer)` and `(merchant)` route groups keep layouts isolated. The merchant layout is denser and uses a different visual treatment; the consumer layout is list/map-first. Middleware redirects based on role and route.

## 5. Data model

Existing tables in `supabase/schema.sql` stay. Two additions:

```sql
-- 0. Extensions required for radius queries
create extension if not exists cube;
create extension if not exists earthdistance;

-- 1. profiles: add last_known location for GPS-fallback
alter table public.profiles
  add column last_lat double precision,
  add column last_lng double precision;

-- 2. reviews table
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  consumer_id uuid not null references public.profiles(id),
  merchant_id uuid not null references public.merchants(id),
  stars       smallint not null check (stars between 1 and 5),
  comment     text check (length(comment) <= 500),
  created_at  timestamptz not null default now(),
  unique (order_id)
);

create index reviews_merchant_id_idx
  on public.reviews (merchant_id, created_at desc);
```

### RLS

- `reviews` select: open to `anon` and `authenticated` (anonymous reads so merchant profile pages work for non-logged-in users).
- `reviews` insert: `auth.uid() = consumer_id` and the order belongs to that consumer with `status = 'picked_up'`.
- `reviews` update/delete: not permitted (immutable after submission).
- `orders` select: consumer sees their own; merchant sees orders for their merchant rows.
- `orders` insert/update: server-side only via service-role key (no client writes).

### Source of truth

`lib/types.ts` re-exports the generated Supabase types and inferred return types from `lib/queries/*`. `lib/types/database.ts` is deleted.

## 6. Pickup verification

The consumer's QR encodes:

```
https://<host>/pickup/<orderId>?c=<6charcode>
```

The 6-character alphanumeric code is generated server-side when the order is created, stored on the order row, and rendered as plain text under the QR for the consumer to read aloud if needed.

**Flow A — camera scan:**
1. Merchant opens `/merchant/orders`, taps "Scan".
2. `html5-qrcode` activates the rear camera.
3. On detect, parse the URL to extract `orderId` and `c`.
4. POST `/api/orders/[id]/pickup` with `{ code }`.
5. Server: order status must be `paid`, merchant_id must match, code must match.
6. On success: `order.status = 'picked_up'`, redirect to next in queue.
7. On failure: toast "Kode tidak cocok" with retry.

**Flow B — type code:**
1. Merchant switches to "Ketik kode" tab.
2. Text input (6 chars, uppercased on submit).
3. Same POST endpoint as Flow A.
4. Same error/success behavior.

Both flows hit the same endpoint. Camera failures degrade gracefully to text input.

## 7. Payment flow (Midtrans sandbox)

```
1. Consumer on /listing/[id] taps "Bayar"
2. Server action calls lib/midtrans.ts → createTransaction({orderId, amount})
   Returns: { snapToken, redirectUrl }
3. Client redirects to Midtrans Snap page (sandbox)
4. Consumer pays with QRIS via sandbox simulator
5. Midtrans POSTs to /api/midtrans/webhook with signed payload
6. Server verifies signature, then:
   - transaction_status in ('settlement', 'capture'):
       order.status = 'paid'
       generate 6-char pickup_code, store on order row
   - transaction_status in ('cancel', 'expire', 'deny'):
       order.status = 'expired'
       listing.quantity += ordered_qty  (single atomic SQL update)
7. Client polls /api/orders/[id]/status every 3s while on /listing/[id]?waiting=1
   On 'paid': redirect to /orders/[id]
   On 'expired': show "Pembayaran kedaluwarsa" with retry button
   After 10 minutes with no terminal status: show
   "Pembayaran belum terkonfirmasi, coba lagi"
```

### Env vars required

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=
```

### Failure modes

- **Webhook before poll:** client sees `paid` on first poll, no orphan state.
- **Webhook never arrives (Midtrans outage):** client times out at 10 min with retry.
- **Race on restock:** `listing.quantity += ordered_qty` is a single `UPDATE` filtered by `id = listing_id`; concurrent cancellations cannot drive quantity negative.
- **Duplicate webhook delivery:** webhook handler is idempotent (checks `order.status` before transitioning).

## 8. Auth and middleware

### Registration

`/register` collects email, password, role (`consumer` or `merchant`). On submit, create auth user, then insert into `profiles` (consumer path) or `merchants` (merchant path). Merchants are redirected to `/merchant/onboarding` on first login.

### Middleware rules

| Route | Logged out | Logged in as consumer | Logged in as merchant |
|---|---|---|---|
| `/`, `/listing/*`, `/merchants/*` | allow | allow | allow |
| `/orders`, `/orders/*` | redirect to `/login` | allow | redirect to `/merchant` |
| `/merchant`, `/merchant/*` | redirect to `/login` | redirect to `/` | allow |
| `/login`, `/register` | allow | redirect to `/` | redirect to `/merchant` |

## 9. Geolocation

- **Primary:** browser `navigator.geolocation` on Discovery page. Cached in `localStorage` with 5-min TTL.
- **Fallback:** text search by city/area name using Nominatim (OpenStreetMap geocoder, free, no API key, rate-limited to 1 req/sec per their usage policy — fine for MVP).
- **Distance & radius filter:** Postgres `earthdistance` extension (`cube` + `earthdistance`) with `ll_to_earth()` and `earth_distance()` computed in meters. Adds an indexed functional expression on `merchants(lat, lng)` so `WHERE earth_distance(ll_to_earth(lat, lng), ll_to_earth(:user_lat, :user_lng)) <= 2000` is planner-friendly.
- **Sort:** `ORDER BY earth_distance(...) ASC, listings.deadline ASC` — closest first, ties broken by soonest expiry.
- **Listings without coordinates:** sorted last (NULL handling).
- **Radius:** 2 km default. Toggle (1, 2, 5 km) in the discovery UI.

## 10. UI direction

### Consumer

- Light, friendly, app-like card grid on Discovery. Photo-forward when available, placeholder otherwise.
- Color: green primary (food/surplus connotation), with neutral background.
- Listing detail: large photo, price block (original struck through, discounted prominent), merchant pill with rating.

### Merchant

- Dense, table-first dashboard. Matte black / dark gray header.
- "Tambah Surplus" is the primary CTA, always visible at top of dashboard.
- Pickup queue uses two-tab layout: Scan / Ketik kode.

## 11. Out of scope (explicit non-goals)

- Native mobile apps
- Couriers / delivery
- Multi-item carts
- Favorites / wishlist
- Push notifications (email only for MVP)
- In-app chat
- Scheduled or recurring pickups
- Ratings by non-pickup users
- Real Midtrans production keys
- Admin / moderation dashboard

## 12. Testing strategy

### Unit

- `lib/geo.ts` Haversine, distance sorting
- `lib/midtrans.ts` signature verification (positive and negative cases)
- `lib/validators/*` zod schemas

### Integration (Supabase local)

- RLS: verify consumer cannot see another consumer's orders, merchant cannot see another merchant's orders
- `unique (order_id)` on reviews: duplicate insert fails
- Reviews only insertable when order is `picked_up`

### End-to-end (Playwright)

- Consumer: register → discover → pay (simulated Midtrans) → see QR
- Merchant: register → onboard → post surplus → see in consumer's discovery
- Pickup: consumer sees QR → merchant types code → order marked `picked_up`
- Review: after pickup, consumer posts review → review visible on merchant profile

## 13. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Midtrans sandbox flakiness | Simulated-payment fallback behind a feature flag; both paths covered by Playwright |
| html5-qrcode browser compat | Tested on Chrome Android (primary target); clear error if camera permission denied, text fallback always available |
| Geolocation permission denied by user | City search fallback in MVP |
| RLS misconfiguration leaks data | Playwright test attempts to read another user's order and asserts RLS rejection |
| Webhook signature key rotation | Documented in `lib/midtrans.ts`; verify on every call |

## 14. Open questions (resolved during brainstorming, recorded for reference)

- **Scan or type?** Both. Camera is primary, text is fallback.
- **Reviews in MVP?** Yes. Required for trust signal on first-time merchant discovery.
- **Real or simulated payment?** Real Midtrans sandbox.
- **Payment timeout?** 10 minutes (Indonesian QRIS UX needs time for app-switching).
- **Favorites?** Cut. YAGNI for impulsive surplus-food buying.
- **Anonymous read of reviews?** Yes. Drives signup conversion.
- **Route groups vs flat routes?** Route groups.

## 15. lib/format.ts (kept, slim)

Kept, not deleted. Houses three responsibilities:

- `formatRupiah(n)` — Indonesian locale, `Rp12.000` style (no decimals, dot thousands).
- `discountPercent(original, discounted)` — returns an integer 1–100 for the badge on listing cards. Clamps the input.
- `formatCountdown(targetIso)` — returns `{ hours, minutes, expired }` for the pickup ticket countdown.

No timezone math, no i18n, no currency conversion. Keep it small.

## 16. Implementation plan

This spec is the input to the next step: the `superpowers:writing-plans` skill will produce a phased, test-driven implementation plan. The plan will be saved to `docs/superpowers/plans/2026-06-16-savebites-plan.md` and approved before any code is written.
