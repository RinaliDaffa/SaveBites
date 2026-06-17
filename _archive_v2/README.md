# SaveBites

A hyper-local surplus food marketplace that lets merchants list end-of-day surplus at 50–70% off and lets nearby consumers pick it up before close.

## What this is

Two-sided mobile-first web app:

- **Consumer flow**: discover listings within a 1–2 km radius on a live map, reserve, then show a pickup QR at the store.
- **Merchant flow**: post surplus in <30 seconds, watch price decay as close-time approaches, see recovered revenue and meals saved.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** with custom design tokens in [app/globals.css](app/globals.css)
- **Zustand** for client state ([lib/store.ts](lib/store.ts))
- **Leaflet + react-leaflet** for the map view (client-only dynamic import)
- In-memory data store ([lib/data.ts](lib/data.ts)) — swap for a real DB later

## Routes

### Consumer
- `/` — landing / role picker
- `/discover` — interactive map of nearby listings + list view
- `/listing/[id]` — listing detail + reserve button
- `/pickup/[id]` — QR code for in-store pickup, with countdown
- `/orders` — my active and past orders
- `/favorites` — favorited merchants

### Merchant
- `/merchant` — dashboard (active listings, incoming orders, recovered revenue)
- `/merchant/new` and `/merchant/post` — 30-second surplus listing form
- `/merchant/listings` — manage all listings
- `/merchant/scan` — verify a customer pickup code

## Design system

Defined as CSS variables in [app/globals.css](app/globals.css):

- **Colors**: cream (`--color-cream`), ink (`--color-ink`), tomato accent (`--color-tomato`), stone-soft, leaf for primary action
- **Typography**: a serif display font for headlines + sans body
- **Components**: rounded cards, sticky blurred header, generous spacing — depth via subtle borders and color

## Data model ([lib/data.ts](lib/data.ts))

```
Merchant    { id, name, cuisine, lat, lng, address, closingTime, hoursOfOperation }
Listing     { id, merchantId, title, emoji, originalPrice, currentPrice, quantity,
              reserved, pickupBy, status: 'available' | 'sold_out' | 'expired' }
Reservation { id, listingId, quantity, priceAtReservation, createdAt, status: 'pending' | 'fulfilled' }
User        { id, name, role, location: { lat, lng }, favorites: string[] }
```

All in-memory `Map<string, T>`. Functions: `getNearbyListings`, `getListing`, `reserveListing`, `postListing`, etc.

## Running locally

```bash
npm install
npm run dev
# http://localhost:3000
```

## What is *not* here yet (intentional)

- Real auth, real payments, real persistence
- WebSockets for live merchant alerts (we revalidate on a 30s tick)
- Production-grade QR scanning (we use a code-paste fallback)

These are wired as in-memory mocks so the UX can be designed and demoed end-to-end.
