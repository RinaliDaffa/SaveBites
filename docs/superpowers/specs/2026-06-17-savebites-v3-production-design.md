# SaveBites — Production-Grade Design Spec (v3)

**Status:** Draft for user review
**Date:** 2026-06-17
**Author:** rinali + claude-opus-4-6
**Replaces:** v2 (no-backend static demo) — v2 is the prototype we are throwing away
**Scope:** Complete production rebuild from a static demo to a real, deployable, scalable web app

---

## 1. Why This Document Exists

The earlier static demo (`/app`, 6 screens, no DB) proved the core idea: a merchant posts a surplus meal at a steep discount, a nearby consumer discovers it, pays, walks over, scans a QR, eats. That part works as a paper prototype.

It does not work as a product. There is no real auth, no real payment, no real-time stock, no map, no pickup verification, no analytics, no money flowing. This spec rebuilds SaveBites as a real production system while keeping the same simple flow the demo validated.

**Core invariant to protect through every decision in this spec:**

> The food is sold cheap because we removed the courier. Self-pickup is not a feature — it is the entire economic model. Every architectural decision in this document exists to keep that model intact at scale.

---

## 2. Core Domain Rules (Non-Negotiable)

These rules are locked. Any implementation that violates them is wrong.

| # | Rule | Reason |
|---|------|--------|
| R1 | **No delivery, no shipping, no courier integration. Ever.** | The 50–70% discount dies the moment a courier is in the loop. |
| R2 | **All orders are picked up by the consumer at the merchant's location.** | The discount is the seller's reward for letting strangers walk in at the end of service. |
| R3 | **Pickup window is hard-capped at 2 hours from listing publish.** | Anything older is unsafe food or a UX footgun. The merchant does not have to think about it; the system enforces it. |
| R4 | **Platform fee is a flat Rp 3.000 per successful order, not a percentage.** | Percentage fees punish scale and create perverse incentives. Flat fee keeps SaveBites cheap for both sides. |
| R5 | **Merchant payout = order subtotal − Rp 3.000 platform fee.** No other deductions. | Transparent, auditable, easy to explain. |
| R6 | **A listing is auto-archived when quantity hits zero OR pickup window expires.** | No zombies in the discovery feed. |
| R7 | **No-show = no refund.** | Food was held, merchant lost the sale, that's the trade-off the buyer accepted at checkout. |
| R8 | **Reservation is atomic and time-boxed (10 minutes).** | Two buyers cannot fight over the last portion; held stock auto-releases. |
| R9 | **Discount is one of {50%, 60%, 70%}.** | The merchant UI offers a slider. The DB enforces the enum. |
| R10 | **Real name + phone number are mandatory at registration.** | Pickup QR must be tied to a real person a cashier can verify. |

---

## 3. Tech Stack (Final Decision)

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 16 (App Router) + React 19** | Server Components, Server Actions, streaming, native Vercel deploy |
| Language | **TypeScript strict mode** | Catch integration bugs at compile time across tRPC/Prisma boundaries |
| API style | **tRPC v11** | End-to-end types from DB → UI. No more drift between frontend and backend. |
| Server logic | **Server Actions + tRPC procedures** | Server Actions for simple mutations from forms; tRPC for the realtime-heavy flows (discovery, stock, pickup) |
| ORM | **Prisma 6** | Schema-as-code, generated types, great migration story |
| Database | **Supabase PostgreSQL 16 + PostGIS 3.4** | Single source of truth. PostGIS enabled via `CREATE EXTENSION postgis;` in Supabase SQL editor. `GIST` index on `merchants.geom` powers the 2 km discovery query. `pg_trgm` for fuzzy meal-name search. We deliberately use Supabase for *everything* (DB, auth, storage) — one vendor, one console, one set of credentials. |
| Cache / realtime | **Redis 7** (Upstash via Vercel Marketplace) | Hot listings cache + Pub/Sub for live stock updates over WebSocket |
| Realtime transport | **Server-Sent Events (SSE)** via Vercel Functions streaming | Cheaper and simpler than WebSockets for one-way "stock changed" pushes |
| Auth | **Supabase Auth** (email + password, phone OTP, Google OAuth) | We use Supabase for auth + storage; we deliberately do **not** use Supabase Postgres — we own our own Postgres for PostGIS. |
| Payments | **Midtrans Snap / Core API** (QRIS, GoPay, OVO, DANA, ShopeePay) | The dominant Indonesian payment gateway. Snap handles the pop-up; we use the Core API server-side for our own QR display. |
| File storage | **Supabase Storage** (private bucket for menu photos) | Avoids building our own signed-URL infra |
| Background jobs | **Vercel Cron** for hourly cleanup; **BullMQ on Upstash Redis** for anything stateful (settlement, refund flows) | Cron for periodic, BullMQ for event-driven |
| Maps | **Leaflet + OpenStreetMap tiles** (free) with **Mapbox Satellite** as opt-in | Avoid Google Maps lock-in and its quota costs |
| QR codes (generation) | `qrcode` npm package, rendered server-side as SVG | Small, no client lib needed |
| QR codes (scanning) | `@zxing/browser` in the merchant scanner page | Best open-source scanner; works with laptop webcam and phone camera |
| Email | **Resend** (transactional only) | Receipts, settlement reports, password reset |
| SMS | **Twilio** (OTP only) | Indonesian delivery is reliable |
| Observability | **Vercel Analytics** + **Axiom** (logs) + **Sentry** (errors) | Free tiers cover MVP |
| Hosting | **Vercel** (Fluid Compute) | One-command deploy, preview per branch, native Postgres/Redis via Marketplace |
| Testing | **Vitest** (unit) + **Playwright** (E2E) + **pg-mem** (DB integration) | One runner per layer |

**Why not Supabase for everything?** Supabase Postgres doesn't ship PostGIS. We need PostGIS for the geo discovery query. We keep Supabase for auth + storage because they're excellent at it.

**Why not Firebase / Firestore?** Geo queries on Firestore are painful (geohash hacks), pricing is opaque, and our domain is relational (orders reference listings reference merchants). PostgreSQL is the right primitive.

**Why not a pure serverless / Lambda design?** The discovery query is geo + sort + filter; cold starts hurt. Vercel Fluid Compute keeps warm instances, runs full Node.js, and bills on Active CPU. Good fit.

---

## 4. System Architecture

```
                         ┌──────────────────────────────────────┐
                         │           Next.js 16 (Vercel)        │
                         │                                      │
   Browser ───────────►  │  ┌──────────────┐   ┌──────────────┐  │
   (consumer / merchant) │  │  React 19    │   │  tRPC v11    │  │
                         │  │  (RSC + RTE) │◄──┤  router      │  │
                         │  └──────────────┘   └──────┬───────┘  │
                         │                            │          │
                         │       Server Actions       │          │
                         │              │             │          │
                         │              ▼             │          │
                         │       ┌────────────────┐   │          │
                         │       │  Domain logic  │◄──┘          │
                         │       │  (services/)   │              │
                         │       └──────┬─────────┘              │
                         │              │                        │
                         │              ▼                        │
                         │       SSE streams  ────►  Redis Pub/Sub│
                         └──────────────┼───────────────────────┘
                                        │
                ┌───────────────────────┼─────────────────────────┐
                ▼                       ▼                         ▼
        ┌──────────────┐        ┌──────────────┐         ┌──────────────┐
        │  PostgreSQL  │        │  Redis 7     │         │  Midtrans    │
        │  + PostGIS   │        │  (Upstash)   │         │  Core API    │
        │              │        │  Cache +     │         │              │
        │  Prisma 6    │        │  Pub/Sub     │         │  Snap Web    │
        └──────────────┘        └──────────────┘         └──────────────┘
                ▲
                │
        ┌──────────────┐        ┌──────────────┐         ┌──────────────┐
        │  Supabase    │        │  Resend      │         │  Twilio      │
        │  Auth +      │        │  (email)     │         │  (SMS OTP)   │
        │  Storage     │        │              │         │              │
        └──────────────┘        └──────────────┘         └──────────────┘
```

**Layer responsibilities:**

- **React 19 (RSC + RTE):** Discovery feed, listing details, merchant dashboard. Server Components for SEO-critical pages; client components only where there's interactivity (map, scanner, reservation timer).
- **tRPC router:** All typed RPC calls from the client. Procedures grouped by domain (`discovery`, `listing`, `order`, `merchant`, `auth`, `payment`, `review`).
- **Server Actions:** Simple form submissions where tRPC ceremony would be overkill (login form, registration, onboarding wizard).
- **Services layer (`lib/services/`):** Pure business logic. No HTTP, no DB driver calls — those go through repositories. This is where R1–R10 are enforced. Services are 100% unit-testable.
- **Repositories (`lib/repositories/`):** One per aggregate root. Each method returns Prisma types or domain types. Stock decrements and reservation creation go through repositories so the transactional boundary is obvious.
- **Postgres + PostGIS:** Source of truth. PostGIS index (`GIST`) on `merchants.geom` powers the `<2km` discovery query.
- **Redis:** Hot listings cache (TTL 60s) and Pub/Sub channel `listings:stock:{id}` for live updates.
- **SSE:** `GET /api/realtime/listings/[id]/stream` — server pushes stock updates to consumer browser.
- **Midtrans:** Snap for web checkout, Core API for our own QR display, webhook for payment confirmation.

---

## 5. Data Model (Prisma Schema)

```prisma
// schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis]
}

enum UserRole {
  CONSUMER
  MERCHANT
}

enum DiscountPct {
  FIFTY   @map("50")
  SIXTY   @map("60")
  SEVENTY @map("70")
}

enum OrderStatus {
  PENDING_PAYMENT
  PAID
  READY_FOR_PICKUP
  PICKED_UP
  EXPIRED
  CANCELLED
  NO_SHOW
}

enum SettlementStatus {
  PENDING
  PAID
  FAILED
}

model User {
  id              String   @id @default(cuid())
  role            UserRole
  email           String   @unique
  phone           String   @unique
  fullName        String
  passwordHash    String?  // null if OAuth-only
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  consumerProfile ConsumerProfile?
  merchantProfile MerchantProfile?

  @@index([role])
}

model ConsumerProfile {
  userId      String   @id
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  // No fields yet; placeholder for future (preferences, dietary flags)
}

model MerchantProfile {
  userId       String   @id
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  businessName String
  picName      String   // Person-in-charge
  picPhone     String
  createdAt    DateTime @default(now())

  merchants    Merchant[]
}

model Merchant {
  id             String   @id @default(cuid())
  ownerId        String
  owner          MerchantProfile @relation(fields: [ownerId], references: [userId])
  name           String
  addressLine    String
  city           String
  geom           Unsupported("geography(Point, 4326)")  // PostGIS: lng/lat
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())

  listings       Listing[]
  orders         Order[]

  @@index([geom], type: Gist)
  @@index([isActive])
}

model Listing {
  id              String       @id @default(cuid())
  merchantId      String
  merchant        Merchant     @relation(fields: [merchantId], references: [id])
  mealName        String
  description     String?
  photoUrl        String?      // Supabase Storage signed URL
  originalPrice   Int          // rupiah, integer (no floats)
  discountPct     DiscountPct
  discountedPrice Int          // computed on write, persisted for query speed
  qtyAvailable    Int
  qtyReserved     Int          // held in active reservations
  qtySold         Int          // paid
  publishedAt     DateTime     @default(now())
  pickupDeadline  DateTime     // publishedAt + 2 hours (R3)

  orders          Order[]

  @@index([merchantId, publishedAt])
  @@index([pickupDeadline])
  @@index([qtyAvailable])
}

model Order {
  id              String      @id @default(cuid())
  consumerId      String
  consumer        User        @relation(fields: [consumerId], references: [id])
  merchantId      String
  merchant        Merchant    @relation(fields: [merchantId], references: [id])
  listingId       String
  listing         Listing     @relation(fields: [listingId], references: [id])

  qty             Int
  unitPrice       Int         // snapshot at purchase time
  subtotal        Int         // qty * unitPrice
  platformFee     Int         // always PLATFORM_FEE_FLAT (R4)
  totalPaid       Int         // subtotal + platformFee

  status          OrderStatus @default(PENDING_PAYMENT)
  qrToken         String      @unique @default(cuid())  // pickup verification
  reservedUntil   DateTime    // 10 min hold (R8)

  midtrans        MidtransPayment?
  pickupEvent     PickupEvent?
  review          Review?

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([consumerId, status])
  @@index([merchantId, status])
  @@index([reservedUntil])
}

model MidtransPayment {
  orderId           String           @id
  order             Order            @relation(fields: [orderId], references: [id])
  midtransTxnId     String           @unique
  paymentType       String           // "qris", "gopay", etc.
  grossAmount       Int
  status            String           // "pending" | "settlement" | "expire" | "cancel" | "deny"
  fraudStatus       String?
  rawCallback       Json?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  settlement        Settlement?
}

model Settlement {
  id                String           @id @default(cuid())
  paymentId         String           @unique
  payment           MidtransPayment  @relation(fields: [paymentId], references: [orderId])
  merchantId        String
  grossAmount       Int
  platformFee       Int
  payoutAmount      Int              // grossAmount - platformFee (R5)
  status            SettlementStatus @default(PENDING)
  paidAt            DateTime?
  createdAt         DateTime         @default(now())

  @@index([merchantId, status])
  @@index([status, createdAt])
}

model PickupEvent {
  id          String   @id @default(cuid())
  orderId     String   @unique
  order       Order    @relation(fields: [orderId], references: [id])
  pickedUpAt  DateTime @default(now())
  scannedBy   String   // merchant userId who scanned
}

model Review {
  id         String   @id @default(cuid())
  orderId    String   @unique
  order      Order    @relation(fields: [orderId], references: [id])
  rating     Int      // 1..5
  comment    String?
  createdAt  DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  action    String   // "listing.create", "order.cancel", etc.
  targetId  String?
  metadata  Json?
  createdAt DateTime @default(now())

  @@index([actorId, createdAt])
  @@index([action, createdAt])
}
```

**Critical invariants enforced at the DB layer:**

- `discountedPrice = originalPrice * (100 - discountPct) / 100`, rounded to nearest 100 rupiah.
- A database CHECK constraint (added via raw migration) ensures `discountPct IN (50, 60, 70)` (R9).
- A CHECK constraint ensures `unitPrice * qty = subtotal`, `platformFee = 3000`, `totalPaid = subtotal + platformFee` (R4, R5).
- PostGIS `GIST` index on `Merchant.geom` is the only way the 2km query stays fast.

---

## 6. The Two Interfaces

### 6.1 Consumer Interface (4 pages)

| Route | Page | Purpose |
|-------|------|---------|
| `/c/discover` | **Discovery** | Map + list of active listings within 2 km of the user. Live stock updates. Filter: radius, price, discount. |
| `/c/listing/[id]` | **Listing detail** | Meal photo, price comparison (strikethrough original), merchant info with map, "Reserve" button |
| `/c/checkout/[orderId]` | **Checkout** | Qty selector, fee breakdown, Midtrans Snap pop-up, 10-min reservation countdown |
| `/c/orders` | **My orders** | Tabs: Active / Completed. Each row shows QR + pickup countdown + merchant map link |

### 6.2 Merchant Interface (3 pages)

| Route | Page | Purpose |
|-------|------|---------|
| `/m/dashboard` | **Dashboard** | Today's orders by status, revenue (gross − fees), quick stats, "New listing" button |
| `/m/listings/new` | **New listing** | Meal name (autocomplete from merchant's menu history), qty, discount slider (50/60/70), photo upload, publish |
| `/m/pickup` | **Pickup queue** | Camera-based QR scanner. On scan: mark order `READY_FOR_PICKUP` → `PICKED_UP`, decrement stock, record pickup event |

### 6.3 Shared (both roles)

| Route | Purpose |
|-------|---------|
| `/login`, `/register`, `/register/merchant`, `/onboarding` | Auth flows with role selection |
| `/account` | Profile, payout settings (merchant), notifications |

### 6.4 API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/trpc/[trpc]` | tRPC endpoint |
| `GET /api/realtime/listings/[id]/stream` | SSE for live stock |
| `POST /api/payments/midtrans/webhook` | Midtrans payment notification |
| `POST /api/payments/midtrans/finish-redirect` | Return URL after Snap closes |
| `GET /api/qr/[token]` | Server-rendered QR code SVG (for shareable backup) |

---

## 7. Critical Flows (End-to-End)

### 7.1 The 10-Step Happy Path: Consumer finds, reserves, pays, picks up

1. Consumer opens `/c/discover`. Browser requests geolocation. Server query:
   ```sql
   SELECT l.*, m.*, ST_Distance(m.geom, ST_MakePoint($lng,$lat)::geography) AS distance_m
   FROM listings l JOIN merchants m ON m.id = l.merchant_id
   WHERE m.is_active AND l.qty_available > 0
     AND l.pickup_deadline > NOW()
     AND ST_DWithin(m.geom, ST_MakePoint($lng,$lat)::geography, 2000)
   ORDER BY distance_m ASC
   LIMIT 50;
   ```
2. Page renders server-side. Client hydrates and opens SSE stream per listing for live stock.
3. Consumer clicks a listing → `/c/listing/[id]`. Renders price comparison, merchant info.
4. Consumer clicks **Reserve**. Browser calls tRPC `order.createReservation` with qty.
5. Server transaction (Postgres `SERIALIZABLE`):
   - Lock `Listing` row (`SELECT ... FOR UPDATE`).
   - Check `qty_available - qty_reserved - qty_sold >= qty`.
   - Insert `Order(status=PENDING_PAYMENT, reservedUntil=NOW()+10min)`.
   - Increment `Listing.qty_reserved` by qty.
   - Commit. Publish `listings:stock:{id}` to Redis.
6. Browser redirects to `/c/checkout/[orderId]`. Snap pop-up opens.
7. Consumer pays via QRIS. Midtrans hits `/api/payments/midtrans/webhook`.
8. Webhook verifies signature. Inside one Postgres transaction at `SERIALIZABLE` isolation: sets `MidtransPayment.status = 'settlement'`, sets `Order.status = 'PAID'`, decrements `Listing.qty_reserved` and increments `Listing.qty_sold` atomically (single `UPDATE ... SET qty_reserved = qty_reserved - $qty, qty_sold = qty_sold + $qty WHERE id = $listingId AND qty_reserved >= $qty RETURNING qty_available - qty_reserved - qty_sold AS remaining`), creates `Settlement` row (status `PENDING`). The conditional WHERE prevents any drift if a prior transaction partially applied.
9. Consumer sees confirmation, taps "Show QR". Server renders QR encoding `order.qrToken`.
10. Consumer walks to merchant. Cashier scans. `PickupEvent` created, `Order.status = PICKED_UP`. **Sale complete.**

### 7.2 Reservation Expiry (Edge Case)

If the consumer doesn't pay within 10 minutes (R8):
- Vercel Cron runs every minute (`*/1 * * * *`): `UPDATE listings SET qty_reserved = qty_reserved - sub.qty FROM (...) WHERE listings.id = ...; UPDATE orders SET status='EXPIRED' WHERE status='PENDING_PAYMENT' AND reserved_until < NOW();`
- The "released" stock reappears in discovery feeds.
- The discovery feed also filters `qty_available > qty_reserved + qty_sold` so reservations aren't double-counted.

### 7.3 Pickup Window Expiry (R3)

Vercel Cron every 5 minutes: `UPDATE listings SET is_archived = true WHERE pickup_deadline < NOW() - INTERVAL '5 minutes'`. Also: `UPDATE orders SET status='EXPIRED' WHERE status='PAID' AND pickup_deadline < NOW() - INTERVAL '15 minutes'` (15-min grace after deadline).

### 7.4 Merchant No-Shows (R7)

Order `EXPIRED` post-deadline → `status='NO_SHOW'`. No refund. Merchant keeps the food cost as the cost of unsold inventory, but is also not charged anything (Midtrans settlement to merchant is `subtotal − platformFee`; if `status=NO_SHOW`, the settlement row's `status` stays `PENDING` and we cancel the payout — merchant doesn't get paid for a meal that wasn't picked up). The Rp 3.000 platform fee is **still charged to the consumer** at payment time and is non-refundable per R7.

### 7.5 Refund Flows

The only refund we honor is **payment success + order never confirmed** (e.g., our DB write to flip `PAID` failed after Midtrans charged). In that case, an admin tool triggers `Midtrans /v2/refund`. No user-facing refund button exists in v1. This is intentional — keeps the support surface tiny.

---

## 8. Money Flow (The Most Important Section)

This section is the source of truth. Any change here is a change to the business model.

### 8.1 At Checkout

| Component | Amount (example) | Notes |
|-----------|------------------|-------|
| Meal price | Rp 25.000 | merchant-set `originalPrice`, discounted by `discountPct` |
| Discount (50%) | −Rp 12.500 | |
| **Discounted price** | **Rp 12.500** | `discountedPrice` in DB |
| Qty | 2 | |
| Subtotal | Rp 25.000 | `qty * unitPrice` |
| Platform fee | **Rp 3.000** (flat) | R4 |
| **Total paid by consumer** | **Rp 28.000** | sent to Midtrans |

### 8.2 On Settlement

| Component | Amount | Recipient |
|-----------|--------|-----------|
| Gross (what Midtrans collected) | Rp 28.000 | SaveBites platform account (Midtrans) |
| Platform fee | Rp 3.000 | Retained by SaveBites (operating revenue) |
| **Merchant payout** | **Rp 25.000** | Transferred to merchant's bank/e-wallet on T+1 |

The merchant payout formula is fixed and shown verbatim in the merchant dashboard:

```
payout_amount = order.subtotal − PLATFORM_FEE_FLAT
```

`PLATFORM_FEE_FLAT = 3000` (rupiah) lives in a single env var `PLATFORM_FEE_FLAT_IDR` so we can change it later without code changes.

### 8.3 Settlement Schedule

- Midtrans settles to our platform account on **T+1**.
- We batch-payout merchants **daily at 09:00 WIB** (cron: `0 2 * * *` UTC) for all `Settlement.status = PENDING` rows where the order is `PICKED_UP` or `NO_SHOW`.
- For `NO_SHOW`, payout = Rp 0 (no food handed over). Platform fee remains earned.

### 8.4 Audit

Every settlement event writes to `AuditLog`. The merchant dashboard shows a ledger view: date, order id, subtotal, fee, payout, status. Immutable from the merchant's perspective.

---

## 9. Discovery & Geolocation

### 9.1 The Query

```sql
-- 2km radius search, sorted by distance, capped to 50 results
SELECT
  l.id, l.meal_name, l.discounted_price, l.qty_available, l.qty_reserved,
  l.pickup_deadline, l.photo_url,
  m.id AS merchant_id, m.name AS merchant_name, m.address_line, m.city,
  ST_Distance(m.geom, ST_MakePoint($1, $2)::geography) AS distance_m
FROM listings l
JOIN merchants m ON m.id = l.merchant_id
WHERE m.is_active = true
  AND l.qty_available > l.qty_reserved + l.qty_sold
  AND l.pickup_deadline > NOW()
  AND ST_DWithin(m.geom, ST_MakePoint($1, $2)::geography, 2000)
ORDER BY distance_m ASC
LIMIT 50;
```

The `GIST` index on `merchants.geom` makes this O(log n) on the geo filter. We further filter in the application layer for discount %, price range, dietary tags (future).

### 9.2 Permission for Location

Browser geolocation API. If denied, fallback to:
1. IP-based city lookup (MaxMind GeoLite2, free).
2. Manual city selector dropdown.

Without coordinates, we fall back to a city-level text filter on `merchants.city`.

### 9.3 Live Stock Updates

After the initial server-rendered page, client opens one SSE stream per visible listing:
```
GET /api/realtime/listings/[id]/stream
```
Server subscribes to Redis channel `listings:stock:{id}`, forwards messages. Client updates the stock badge live. Stream auto-closes after 2 minutes of inactivity.

---

## 10. Authentication & Authorization

### 10.1 Flow

1. `/register` — choose role (consumer or merchant). Email + password OR Google OAuth. Real name + phone mandatory (R10). Phone verified via Twilio OTP.
2. Consumer → `/c/discover` immediately.
3. Merchant → onboarding wizard (`/onboarding`): business name, address (geocoded via Nominatim, free), PIC name, bank/e-wallet for payout. Then `/m/dashboard`.

### 10.2 Middleware

`middleware.ts` checks Supabase session JWT. Role-based route protection:
- `/c/*` requires `User.role = CONSUMER` (or MERCHANT — they can browse as a buyer too).
- `/m/*` requires `User.role = MERCHANT`.
- `/api/admin/*` requires `User.role = ADMIN` (out of scope for v1, but the gate exists).

### 10.3 Service-to-Service Auth

Midtrans webhook verifies signature using `MIDTRANS_SERVER_KEY`. No public endpoint trusts the request body without verifying the signature hash.

---

## 11. Observability & Operations

### 11.1 Logging

- All tRPC procedures log to Axiom with structured fields: `userId`, `procedure`, `duration`, `error?`.
- All Midtrans webhook hits log the raw payload (after signature check) to a separate audit table.
- PII (phone, email) is hashed in logs.

### 11.2 Error Tracking

Sentry captures uncaught exceptions in:
- tRPC procedures
- Server Actions
- Midtrans webhook handler
- Cron jobs

### 11.3 Alerts

| Signal | Threshold | Channel |
|--------|-----------|---------|
| 5xx error rate | > 1% over 5 min | Slack `#alerts` |
| Midtrans webhook failure | any | Slack `#payments` |
| Cron job miss | any | PagerDuty (admin phone) |
| Listing creation failure | > 5 in 5 min | Slack `#merchants` |

### 11.4 Admin Dashboard

Out of scope for v1 (use raw SQL via `psql` or a Supabase Studio view). Logged as a v2 follow-up.

---

## 12. Testing Strategy

| Layer | Tool | What we test |
|-------|------|--------------|
| Unit | Vitest | All services (`createReservation`, `cancelExpiredReservations`, `computeMerchantPayout`, `verifyMidtransSignature`). 100% coverage on the services layer. |
| Repository | Vitest + pg-mem | Prisma queries, transaction semantics, PostGIS query correctness |
| Integration | Vitest + testcontainers (real Postgres) | End-to-end service calls against a real DB |
| API contract | tRPC + supertest snapshot | All tRPC procedures' input/output shapes locked |
| E2E | Playwright | The 10-step happy path. Reservation expiry. Pickup verification. |
| Payment | Midtrans sandbox | Snap pop-up, QRIS flow, webhook signature handling |

**Critical regression tests:**
- Two consumers race for the last portion → only one wins (atomic reservation).
- Reservation not paid → stock returns to feed after 10 min.
- Pickup deadline passes → listing disappears from feed.
- Midtrans signature tampered → webhook rejected.

---

## 13. Folder Structure

```
savebites/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (auth)/register/page.tsx
│   ├── (auth)/register/merchant/page.tsx
│   ├── (auth)/onboarding/page.tsx
│   ├── c/
│   │   ├── discover/page.tsx
│   │   ├── listing/[id]/page.tsx
│   │   ├── checkout/[orderId]/page.tsx
│   │   └── orders/page.tsx
│   ├── m/
│   │   ├── dashboard/page.tsx
│   │   ├── listings/new/page.tsx
│   │   └── pickup/page.tsx
│   ├── account/page.tsx
│   ├── api/
│   │   ├── trpc/[trpc]/route.ts
│   │   ├── realtime/listings/[id]/stream/route.ts
│   │   ├── payments/midtrans/webhook/route.ts
│   │   ├── payments/midtrans/finish-redirect/route.ts
│   │   └── qr/[token]/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── services/         # Pure business logic (R1–R10 enforced here)
│   │   ├── listing.service.ts
│   │   ├── order.service.ts
│   │   ├── reservation.service.ts
│   │   ├── merchant.service.ts
│   │   ├── payment.service.ts
│   │   ├── settlement.service.ts
│   │   └── review.service.ts
│   ├── repositories/     # Prisma + raw queries (PostGIS)
│   │   ├── listing.repo.ts
│   │   ├── merchant.repo.ts
│   │   ├── order.repo.ts
│   │   └── geo.repo.ts   # PostGIS helpers
│   ├── trpc/
│   │   ├── router.ts
│   │   ├── context.ts
│   │   ├── trpc.ts
│   │   └── procedures/
│   │       ├── discovery.ts
│   │       ├── listing.ts
│   │       ├── order.ts
│   │       ├── merchant.ts
│   │       ├── auth.ts
│   │       ├── payment.ts
│   │       └── review.ts
│   ├── realtime/
│   │   ├── redis.ts
│   │   └── pubsub.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── auth/
│   │   ├── session.ts
│   │   └── rbac.ts
│   ├── midtrans/
│   │   ├── client.ts
│   │   └── verify.ts
│   ├── constants.ts      # PLATFORM_FEE_FLAT, MAX_PICKUP_HOURS, etc.
│   └── utils/
├── components/
│   ├── primitives/       # Button, Input, Card, Badge, Modal, Toast
│   ├── consumer/         # DiscoverMap, ListingCard, CheckoutSummary, OrderTicket, QrDisplay
│   ├── merchant/         # NewListingForm, PickupQueue, QrScanner, EarningsCard
│   └── shared/           # NavBar, RoleSwitcher, LocationPrompt
├── middleware.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── supabase/
│   ├── schema.sql        # Storage buckets, RLS policies for storage
│   └── config.toml
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── docs/superpowers/specs/
├── scripts/
│   ├── seed.ts
│   └── cron/             # Local-runnable versions of cron jobs
├── package.json
├── tsconfig.json
├── next.config.ts
├── .env.example
└── README.md
```

---

## 14. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/savebites?sslmode=require
DIRECT_URL=postgresql://user:pass@host:5432/savebites?sslmode=require

# Supabase (auth + storage only)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx...

# Midtrans
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
MIDTRANS_WEBHOOK_URL=https://savebites.id/api/payments/midtrans/webhook

# Twilio (OTP)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_VERIFY_SERVICE_SID=VExxx

# Resend (email)
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=SaveBites <no-reply@savebites.id>

# Sentry
SENTRY_DSN=https://xxx@sentry.io/xxx

# App config
NEXT_PUBLIC_APP_URL=https://savebites.id
PLATFORM_FEE_FLAT_IDR=3000
MAX_PICKUP_WINDOW_HOURS=2
RESERVATION_TTL_MINUTES=10
DISCOVERY_RADIUS_METERS=2000
```

---

## 15. Out of Scope for v1

These are deliberately not built. They will be added later when there's evidence of demand.

- Delivery / courier integration (violates R1 — never).
- Multi-language / i18n (Indonesian only v1).
- Native mobile apps (web responsive only).
- Push notifications (web push only as follow-up).
- Subscription / membership tiers.
- Loyalty points.
- Promo codes.
- Refund UI (admin-only via DB / API).
- Admin dashboard UI (use psql / Studio).
- Analytics dashboards (Vercel Analytics only for v1).
- Webhooks to merchants for their own systems.

---

## 16. Open Questions for User Review

These are the decisions in this spec that you might want to push back on. Please flag any of them before we move to the implementation plan.

1. **Merchant payout timing: T+1 daily.** Aggressive but standard for Indonesian marketplaces. OK?
2. **No-show = no refund.** Strict, but defensible. OK?
3. **Phone OTP required at registration.** Adds 30 seconds to signup. OK?
4. **No in-app refund flow.** Admin-only. Keeps the UI simple, accepts more support tickets. OK?
5. **Vercel-only hosting.** Lock-in, but easiest path. OK?
6. **Supabase for auth + storage, our own Postgres for data.** Two vendors. OK?
7. **Settlement batch at 09:00 WIB.** Final time TBD by ops.

---

## 17. Definition of Done (v1)

SaveBites v1 is shippable when:

- [ ] A consumer can register, browse a 2 km map, see a listing, reserve, pay via QRIS, walk to the merchant, and scan to complete pickup.
- [ ] A merchant can register, onboard a business, post a listing in under 30 seconds, and scan a QR to release a meal.
- [ ] Two consumers racing for the last portion — only one succeeds.
- [ ] An unpaid reservation releases its hold after 10 minutes.
- [ ] A listing vanishes from the feed 2 hours after publish.
- [ ] All money math (subtotal, Rp 3.000 fee, payout) is correct in every test.
- [ ] The 6-screen static demo from v2 is fully replaced; no dead code remains.
- [ ] Lighthouse performance score ≥ 85 on `/c/discover`.
- [ ] 95% of tRPC procedures have unit tests.
- [ ] The 10-step happy path has a passing Playwright E2E test.

---

**End of spec.**