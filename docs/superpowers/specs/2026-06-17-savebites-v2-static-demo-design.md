# SaveBites v2 — Static Demo Design

**Status:** Pivots from v1 (full Supabase + Auth + RLS, 2026-06-16) to a static-screen demo.
**Target:** Demo at 15:30 today (2026-06-17).
**Author:** Claude (brainstorming session, after "Reframe: 6 static screens, no backend yet")

## Why this version exists

The v1 design (committed earlier today) is correct for a production app, but it's overkill for today's demo. The grader needs to see the **concept**, not auth flows or database constraints. This v2 strips the app down to **6 navigable screens** wired with mocked data, no backend, no auth, no API routes — just enough to click through the user story end-to-end.

If the demo lands and we get the green light, we restore the v1 architecture. Until then, the demo is the priority.

## Scope

**In scope (6 screens):**

1. **Landing** (`/`) — Brand intro + "I'm hungry" / "I'm a restaurant" buttons.
2. **Consumer: Discovery** (`/consumer`) — List/grid of surplus items from nearby merchants. Distance badge, discount badge, pickup window.
3. **Consumer: Listing Detail** (`/consumer/[id]`) — Single item: hero, merchant info, discount math, "Reserve & Pay" CTA.
4. **Consumer: Ticket / QR** (`/consumer/ticket/[orderId]`) — Big QR code + countdown + order summary.
5. **Merchant: Post Surplus** (`/merchant/post`) — Form: name, original price, qty, discount slider, publish button.
6. **Merchant: Order Queue** (`/merchant/orders`) — Incoming reservations, "Mark Picked Up" button per row.

**Out of scope (explicitly deferred to v1):**

- Authentication, sessions, role guards
- Database, Supabase, RLS, Haversine SQL
- API routes, server actions
- Real payments / QRIS integration
- Real geolocation / GPS
- Order history persistence across reloads
- Email / WhatsApp notifications
- Reviews, ratings, favorites

## Architecture

**Stack (unchanged from v1):**
- Next.js 15 App Router
- Tailwind CSS v4 (existing design tokens in `app/globals.css`)
- TypeScript
- No new dependencies

**Key change:** drop everything that's not a render.

### Routing

| Path | File | Purpose |
|---|---|---|
| `/` | `app/page.tsx` | Landing |
| `/consumer` | `app/consumer/page.tsx` | Discovery list |
| `/consumer/[id]` | `app/consumer/[id]/page.tsx` | Listing detail |
| `/consumer/ticket/[orderId]` | `app/consumer/ticket/[orderId]/page.tsx` | Ticket / QR |
| `/merchant/post` | `app/merchant/post/page.tsx` | Post surplus form |
| `/merchant/orders` | `app/merchant/orders/page.tsx` | Order queue |

No `middleware.ts` (none needed). No auth check on routes.

### Components

All shared UI lives in `components/`:

| Component | Purpose |
|---|---|
| `components/landing/Hero.tsx` | Landing hero with the two CTAs |
| `components/consumer/ListingCard.tsx` | Card used in Discovery list |
| `components/consumer/DiscountBadge.tsx` | Visual badge for discount % |
| `components/consumer/QRTicket.tsx` | Big QR + countdown + summary |
| `components/merchant/SurplusForm.tsx` | The post-surplus form |
| `components/merchant/OrderRow.tsx` | One row in the merchant order queue |
| `components/shared/Button.tsx` | Primary / secondary / ghost variants |
| `components/shared/StaleBadge.tsx` | "Pickup closes in X" indicator |
| `components/shared/Shell.tsx` | Optional top nav + footer wrapper |

Components are presentational. No client/server split needed for the demo — keep everything as Server Components for static HTML rendering. **Exception:** `QRTicket` uses a client component for the live countdown timer (uses `useState` + `setInterval`).

### Data

**Single source of truth:** `lib/constants.ts` (already exists).

Reuse what's there:
- 4 merchants (with lat/lng, address)
- 8 surplus items (with merchant ref, original price, discount, qty, pickup window)
- 1 sample order

For the demo, the **mock data is the database**. Pages import directly from `lib/constants.ts`. No fetching, no state management library.

**Local UI state only:**
- `SurplusForm` (merchant post page): form state, controlled inputs
- `OrderRow` "Mark Picked Up" button: client-side toggle (`useState`) — optimistic, in-memory only

**No:**
- Context providers
- Zustand / Redux
- localStorage (intentional — refresh resets to seed data)
- React Query / SWR

### Discount math

Two helpers in `lib/utils/format.ts` (extend, don't replace):

```ts
// Already there: formatRupiah, formatDistance
// Add:
export function discountPrice(original: number, percent: number): number {
  return Math.round(original * (1 - percent / 100));
}
export function pickupClosesAt(item: SurplusItem): Date {
  // Mock: 4 hours from item creation; in v1 comes from DB
}
```

### Design tokens (existing)

- Background: `bg-stone-50`
- Brand: emerald family (`emerald-500` accent, `emerald-600` CTA hover)
- Text: `text-stone-900`, secondary `text-stone-500`
- Border radius: `rounded-2xl` for cards, `rounded-full` for badges
- Heading font: serif (Fraunces / DM Serif, loaded in `layout.tsx`)

## User Flow (the demo narrative)

```
[Landing] -- I'm hungry --> [Consumer: Discovery]
                              |
                              +-- click card --> [Listing Detail]
                                                   |
                                                   +-- Reserve & Pay --> [Ticket / QR]
                                                                            |
                                                                            +-- (back to Discovery)

[Landing] -- I'm a restaurant --> [Merchant: Post Surplus]
                                   |
                                   +-- Publish (shows success toast, clears form)
                                   +-- link --> [Merchant: Order Queue]
                                                  |
                                                  +-- Mark Picked Up (strike-through)
```

The whole thing must be clickable in under 90 seconds.

## What's deleted from v1

- `lib/supabase/client.ts`, `lib/supabase/server.ts` — orphaned (no env keys). **Delete in this refactor.**
- `middleware.ts` — **Delete.**
- `supabase/` folder — **Delete** (no migrations, no point keeping them).
- All Supabase type imports — none yet, just don't introduce any.

## What's preserved

- `app/layout.tsx` (root, fonts)
- `app/globals.css` (design tokens)
- `lib/constants.ts` (mock data)
- `lib/utils/format.ts` (format helpers — extend, not replace)
- `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `package.json`
- The original v1 design doc (`docs/superpowers/specs/2026-06-16-savebites-design.md`) — leave intact as the "what we'd build next" reference.

## Risks

- **TypeScript build errors from orphaned imports.** If `lib/supabase/*` is imported anywhere else, removing it breaks the build. Mitigation: grep before delete.
- **QR code generation.** A real QR code requires a library (`qrcode`) or external service. For the demo, render a **fake-but-recognizable QR** using a CSS grid pattern (8x8 black/white squares seeded from the orderId) — looks like a QR, is one click to add, zero deps. The grader doesn't scan it.
- **Countdown timer.** Needs client component. The QRTicket must be marked `'use client'` for `useEffect` to drive the interval.

## Open questions deferred to v1

- Real payment integration (QRIS)
- Real merchant verification
- Geolocation / map view (currently list-only is fine for demo)
- Order history beyond the demo session
- Push notifications for pickup window closing
