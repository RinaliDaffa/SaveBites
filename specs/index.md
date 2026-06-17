# SaveBites — Design Document

> **Project:** SaveBites — Hyperlocal surplus food marketplace, self-pickup only.
> **Stack:** Next.js 16 (App Router), Supabase Auth + DB, Supabase Storage, Midtrans QRIS, Zustand, Zod, Lucide React, Tailwind v4.
> **Supabase Project:** `dbizcmezzdsusqymagln` — **will be RESET on first run** if env vars set.

---

## 1. Problem Statement

Restaurants/bakeries throw away surplus food daily. Consumers want affordable meals. SaveBites bridges the gap: merchants list expiring-surplus food at 50–70% discount, consumers book and pay instantly within a 2 km radius, then walk to pick up — no delivery, no courier logistics.

## 2. Core Flows

### Consumer Side (3 Steps)

```
[Home/Discover] → [Tap listing → Detail] → [Cart (Zustand)] → 
[Checkout/Payment] → [My Pickups — QR Ticket]
```

1. **Discover:** Auto-detect GPS location via Browser Geolocation API. Show surplus listings within 2 km via map + list toggle.
2. **Flash Book & Pay:** Add to cart, checkout with QRIS/Midtrans. Stochastic payment success (demo-safe).
3. **Pickup Ticket:** QR Code + countdown. Consumer goes to merchant.

### Merchant Side

```
[Login] → [Post Surplus] → [View Orders Queue] → [Scan QR] → [Hand Over]
```

1. **Quick Publish:** Search/select menu item, set quantity, slider discount (50/60/70%), set pickup deadline. One-click publish.
2. **Order Queue:** Live-updating list of paid orders with QR codes, ready for scanning.
3. **Scan QR:** Camera-based QR scanner (web). Validates code, marks order complete.

### Auth (Shared)

```
[Landing Page] → [Sign Up: Role Picker] → [Consumer → Discover | Merchant → Dashboard]
```

1. **Sign Up:** Email + password + role picker (Consumer / Merchant).
   - Consumer → direct to home/discover.
   - Merchant → merchant registration flow (name, address, GPS, business hours).
2. **Sign In:** Email + password → route by role.
3. **Profile:** Basic fields (name, phone). Merchant gets extra profile (business details).

---

## 3. Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Platform | Web (Next.js) | No app store friction, works on any phone |
| Auth | Supabase Auth | Email/password + RLS out of the box |
| DB | Supabase PostgreSQL | Geospatial queries, real-time, free tier |
| Storage | Supabase Storage | Food image upload for merchants |
| Payments | Midtrans (QRIS) | Standard in Indonesia, sandbox mode |
| GPS | Browser Geolocation API | Native browser API, no native SDK needed |
| QR Generation | qrcode npm (server) | Simple, deterministic, no native camera needed |
| QR Scanning | html5-qrcode (web) | Camera-based QR scan on merchant side |
| Cart State | Zustand | Lightweight, survives page navigation |
| Validation | Zod | Schema validation for server actions |
| Icons | Lucide React | Clean, tree-shakeable icons |
| Styling | Tailwind CSS v4 | Built into Next.js 16 |
| Deployment | Vercel | Zero-config for Next.js + Supabase |

---

## 4. Folder Structure

```
savebites/
├── app/
│   ├── (auth)/                # Route group for auth pages
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── consumer/              # Consumer route group
│   │   ├── home/              # Discovery (map + list)
│   │   ├── listing/[id]/      # Individual listing detail
│   │   ├── cart/              # Cart page
│   │   ├── checkout/          # Payment
│   │   └── pickups/           # My tickets
│   ├── merchant/              # Merchant route group
│   │   ├── dashboard/         # Order queue
│   │   ├── publish/           # Post surplus
│   │   ├── register/          # Business registration
│   │   └── profile/           # Edit business details
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Landing page (role-aware)
│   ├── loading.tsx            # Global loading
│   └── globals.css            # Tailwind directives + theme
├── components/
│   ├── layout/                # Header, footer, nav, sidebar
│   ├── ui/                    # Button, Input, Card, Badge, Modal, Skeleton
│   ├── consumer/              # ListingCard, CartSummary, QRTicket, etc.
│   └── merchant/              # OrderQueue, QRScanner, QuickPublish, etc.
├── lib/
│   ├── supabase/              # client.ts, server.ts, admin.ts
│   ├── actions/               # Server actions (auth, listing, orders, etc.)
│   ├── validation/            # Zod schemas
│   ├── utils.ts               # formatRupiah, classNames, cn helpers
│   └── constants.ts           # APP_NAME, ROLES, DISCOUNT_TIERS, etc.
├── hooks/                     # useGeolocation, useMidtrans, useMerchantOrders, etc.
├── stores/                    # Zustand stores (cart, auth, etc.)
├── types/                     # TS interfaces and types
├── data/                      # Seed data (fake listings, merchants)
├── tests/
│   ├── integration/           # E2E tests
│   └── setup.ts               # Vitest globals setup
└── specs/                     # Design docs
```

---

## 5. Database Schema (PostgreSQL + Supabase)

### Tables

1. **profiles** — Extends auth.users with role and basic info
2. **merchants** — Business details, GPS coordinates, operating hours
3. **menu_items** — Surplus listings (name, category, original_price, surplus_price, quantity, available_until)
4. **orders** — Purchase transactions with status, payment, pickup deadline
5. **order_items** — Line items per order
6. **reviews** — Post-purchase ratings and comments

All tables have RLS policies enforced. Supabase triggers for timestamps and auto-creating profiles on signup.

---

## 6. Seed Data

On first visit (when DB is empty + seed flag), populate:
- 10 fake merchants (Yogyakarta area, realistic names, GPS within ±0.02° of Prawirotaman)
- 30 fake menu items (each merchant has 3–5 items with surplus pricing)
- 3 fake consumer profiles
- 3 sample orders (completed, pending, expired)

This ensures the app always has data to show — even without real merchants registering.

---

## 7. Payment Strategy (Demo-Safe)

**Midtrans Core API** (checkout.js + snap) for QRIS payments. On the server side (Next.js route handler or server action):
1. Create a Midtrans transaction
2. Return the Snap token
3. Client opens Snap overlay
4. Midtrans notifies back via webhook OR polling confirms payment

**Fallback for demo/testing:** If Midtrans env vars are not set (local dev or missing config), simulate payment with stochastic success (80% pass rate, 20% decline). Never throws hard errors. Works out of the box.

---

## 8. Navigation & Routing

- **Role-based routes:** Protected by server-side auth checks in layouts and middleware
- **Landing page (`/`):** Shows "Eat well, waste less" hero with CTA to sign up/in. After auth, redirects to role-appropriate dashboard/home
- **Consumer routes under `/consumer/*`:** Discovery, cart, checkout, pickups
- **Merchant routes under `/merchant/*`:** Dashboard, publish, register, profile
- **Shared layout:** Sidebar for desktop, bottom nav for mobile
- **Back navigation:** Every page has a visible back button and breadcrumbs where applicable

---

## 9. Error Handling Strategy

- **Client errors:** Toast notifications (success/error/info/warning variants)
- **Server errors:** Graceful error boundaries with retry options
- **Network errors:** Offline detection with queued actions
- **Payment errors:** Clear messaging, no money charged on decline
- **GPS errors:** Fallback to manual city selection if location denied
- **QR scan errors:** Manual code input fallback if camera unavailable
- **No data fallback:** Seed data shows app works; empty states suggest next steps

---

## 10. Testing Strategy

| Test Type | Scope | Location |
|---|---|---|
| Unit | Server actions, utilities, validation | `tests/unit/` |
| Integration | Auth flows, payment sandbox, GPS | `tests/integration/` |
| UI Component | Cards, buttons, forms, layout | `components/*.test.tsx` |
| E2E | Full consumer journey, merchant publish | `tests/e2e/` |

---

## 11. Design System

- **Colors:** Emerald green (#10b981) primary, stone neutral, red for discounts
- **Typography:** Fraunces (serif headings), Geist Sans (body)
- **Spacing:** 4px grid system (Tailwind defaults)
- **Components:** Consistent props, variants, and accessibility attributes across all UI
- **Dark mode:** Supported via Tailwind's dark: variants

---

## 12. Key Constraints

1. **Self-pickup only** — no delivery, no courier integration
2. **Radius filter ≤ 2km** — hard cap, GPS-based
3. **Stochastic payment success** — never blocks user flow
4. **No app store** — web-first, responsive design
5. **Seed data guaranteed** — app always has listings to show
6. **RLS enforced** — every table has row-level security
