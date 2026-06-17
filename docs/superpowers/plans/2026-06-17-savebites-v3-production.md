# SaveBites v3 Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a deployable production MVP of SaveBites — a real-time surplus-meal marketplace with QR pickup, Midtrans payments, T+1 merchant payouts, and admin dashboard.

**Architecture:** Next.js 15 App Router on Vercel, Supabase (Postgres/PostGIS + Auth + Storage) as single vendor. Server Actions for mutations, Supabase Realtime for live order queue, Midtrans Snap for payments, Vercel Cron for T+1 settlement batch.

**Tech Stack:** Next.js 15 (App Router, RSC, Server Actions), TypeScript strict, Supabase JS v2, @supabase/ssr, Tailwind v4, shadcn/ui, Zustand, Zod, midtrans-client, @upstash/ratelimit, Vitest, Playwright.

---

## Phase 0 — Foundation Reset

### Task 0.1: Wipe and reinit project

**Files:**
- Delete: `app/`, `lib/`, `supabase/`, `types/`, `middleware.ts`, `next.config.ts`, `postcss.config.mjs`, `README.md`
- Modify: `package.json` (replace deps), `tsconfig.json` (strict), `eslint.config.mjs`, `.env.local` (replace keys)
- Create: `app/layout.tsx`, `app/page.tsx`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts`, `middleware.ts`

- [ ] **Step 1: Backup current `app/`, `lib/`, `supabase/`, `types/`, `middleware.ts` to `_archive_v2/`**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
mkdir -p _archive_v2
mv app lib supabase types middleware.ts _archive_v2/
```

- [ ] **Step 2: Replace `package.json`**

```json
{
  "name": "savebites",
  "version": "3.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:push": "supabase db push",
    "db:reset": "supabase db reset"
  },
  "dependencies": {
    "next": "15.0.3",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@supabase/supabase-js": "^2.45.4",
    "@supabase/ssr": "^0.5.1",
    "midtrans-client": "^1.4.2",
    "zustand": "^5.0.0",
    "zod": "^3.23.8",
    "date-fns": "^4.1.0",
    "date-fns-tz": "^3.2.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "lucide-react": "^0.460.0",
    "nanoid": "^5.0.7",
    "@upstash/ratelimit": "^2.0.3",
    "@upstash/redis": "^1.34.3"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0-beta.4",
    "@tailwindcss/postcss": "^4.0.0-beta.4",
    "postcss": "^8.4.47",
    "eslint": "^9.13.0",
    "eslint-config-next": "15.0.3",
    "supabase": "^1.207.9",
    "vitest": "^2.1.4",
    "@vitejs/plugin-react": "^4.3.3",
    "playwright": "^1.48.0",
    "@playwright/test": "^1.48.0"
  }
}
```

- [ ] **Step 3: Install**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
rm -rf node_modules package-lock.json
npm install
```

Expected: install completes, no peer-dep errors that block.

- [ ] **Step 4: Replace `tsconfig.json` (strict)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "_archive_v2"]
}
```

- [ ] **Step 5: Create `postcss.config.mjs`**

```js
export default { plugins: { '@tailwindcss/postcss': {} } };
```

- [ ] **Step 6: Create `app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-brand-50: #f0fdf4;
  --color-brand-500: #22c55e;
  --color-brand-600: #16a34a;
  --color-brand-700: #15803d;
}

html, body { height: 100%; }
body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
```

- [ ] **Step 7: Create `app/layout.tsx`**

```tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SaveBites',
  description: 'Hemat makanan, selamatkan bumi.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 8: Create `app/page.tsx` (placeholder landing)**

```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-brand-600">SaveBites</h1>
      <p className="mt-2 text-slate-600">Hemat makanan surplus, selamatkan bumi.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="rounded-lg bg-brand-600 px-4 py-2 text-white">Masuk</Link>
        <Link href="/register" className="rounded-lg border px-4 py-2">Daftar</Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Replace `.env.local` with placeholder keys**

```bash
# Replace C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CRON_SECRET=dev-secret-change-me
```

- [ ] **Step 10: Verify build**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npm run typecheck
npm run build
```

Expected: build succeeds, both routes compile.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: reset to v3 foundation (next 15, supabase ssr, midtrans, tailwind v4)"
```

---

## Phase 1 — Supabase Project + Schema

### Task 1.1: Init Supabase local

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/00000000000001_init.sql`, `supabase/seed.sql`, `.gitignore` (verify `supabase/.temp` ignored)

- [ ] **Step 1: Init Supabase**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npx supabase init
```

- [ ] **Step 2: Verify `.gitignore` contains `supabase/.temp`**

Append if missing:
```
supabase/.temp
supabase/.branches
```

- [ ] **Step 3: Start local stack**

```bash
npx supabase start
```

Expected: prints API URL, anon key, service_role key. Note them.

- [ ] **Step 4: Update `.env.local` with local keys from step 3**

Replace placeholders with values printed by `supabase start`.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml .gitignore
git commit -m "chore: init supabase local stack"
```

### Task 1.2: Create database migration

**Files:**
- Create: `supabase/migrations/00000000000001_init.sql`

- [ ] **Step 1: Write migration (full content)**

```sql
-- ============================================================================
-- SaveBites v3 — Initial schema
-- ============================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto;

-- ---------- enums ----------
create type user_role as enum ('consumer', 'merchant', 'admin');
create type order_status as enum ('paid', 'picked_up', 'expired', 'cancelled', 'refunded');
create type payout_status as enum ('pending', 'processing', 'paid', 'failed');

-- ---------- profiles ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'consumer',
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text check (phone ~ '^\+?[0-9]{8,15}$'),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- merchants ----------
create table merchants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references profiles(id) on delete cascade,
  store_name text not null check (char_length(store_name) between 2 and 80),
  address text not null,
  location geography(Point, 4326) not null,
  cuisine_type text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index merchants_location_gix on merchants using gist(location);
create index merchants_active_idx on merchants(is_active) where is_active = true;

-- ---------- listings ----------
create table listings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  description text,
  original_price integer not null check (original_price > 0),
  discount_percent integer not null check (discount_percent between 50 and 70),
  final_price integer generated always as ((original_price * (100 - discount_percent)) / 100) stored,
  stock integer not null check (stock >= 0),
  pickup_start timestamptz not null,
  pickup_end timestamptz not null,
  status text not null default 'active' check (status in ('active','sold_out','expired','cancelled')),
  created_at timestamptz not null default now(),
  check (pickup_end > pickup_start)
);
create index listings_merchant_idx on listings(merchant_id);
create index listings_active_pickup_idx on listings(status, pickup_end) where status = 'active';

-- ---------- orders ----------
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default 'SB-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6),
  consumer_id uuid not null references profiles(id) on delete restrict,
  listing_id uuid not null references listings(id) on delete restrict,
  merchant_id uuid not null references merchants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  total_price integer not null check (total_price > 0),
  status order_status not null default 'paid',
  qr_code text not null unique,
  pickup_code text not null,
  pickup_start timestamptz not null,
  pickup_end timestamptz not null,
  midtrans_transaction_id text,
  midtrans_payment_type text,
  paid_at timestamptz not null default now(),
  picked_up_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index orders_consumer_idx on orders(consumer_id, created_at desc);
create index orders_merchant_status_idx on orders(merchant_id, status, created_at desc);
create index orders_pickup_end_idx on orders(status, pickup_end) where status = 'paid';

-- ---------- payouts ----------
create table payouts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete restrict,
  period_date date not null,
  order_count integer not null,
  gross_amount integer not null,
  platform_fee integer not null,
  net_amount integer not null,
  status payout_status not null default 'pending',
  paid_at timestamptz,
  transfer_reference text,
  created_at timestamptz not null default now(),
  unique (merchant_id, period_date)
);
create index payouts_pending_idx on payouts(status, period_date) where status = 'pending';

-- ---------- audit ----------
create table admin_audit_log (
  id bigserial primary key,
  actor_id uuid references profiles(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------- updated_at trigger fn ----------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger merchants_updated_at before update on merchants
  for each row execute function set_updated_at();

-- ---------- decrement stock atomically ----------
create or replace function decrement_listing_stock(p_listing_id uuid, p_qty int)
returns boolean language plpgsql as $$
declare v_remaining int;
begin
  update listings
  set stock = stock - p_qty
  where id = p_listing_id and status = 'active' and stock >= p_qty
  returning stock into v_remaining;
  if not found then return false; end if;
  if v_remaining = 0 then
    update listings set status = 'sold_out' where id = p_listing_id;
  end if;
  return true;
end;
$$;

-- ---------- expire orders helper (called by cron) ----------
create or replace function expire_overdue_orders() returns integer language plpgsql as $$
declare v_count int;
begin
  with expired as (
    update orders
    set status = 'expired'
    where status = 'paid' and pickup_end < now()
    returning 1
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$;
```

- [ ] **Step 2: Apply migration locally**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npx supabase db reset
```

Expected: migrations apply, no errors.

- [ ] **Step 3: Verify tables**

```bash
npx supabase db diff
```

Expected: empty diff (schema in sync).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): initial schema (profiles, merchants, listings, orders, payouts, audit)"
```

### Task 1.3: RLS policies

**Files:**
- Create: `supabase/migrations/00000000000002_rls.sql`

- [ ] **Step 1: Write RLS migration**

```sql
-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table profiles enable row level security;
alter table merchants enable row level security;
alter table listings enable row level security;
alter table orders enable row level security;
alter table payouts enable row level security;
alter table admin_audit_log enable row level security;

-- profiles: owner can read/update own; admin can read all
create policy "profile self read" on profiles for select
  using (auth.uid() = id or exists(
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
create policy "profile self update" on profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profile self insert" on profiles for insert
  with check (auth.uid() = id);

-- merchants: public read of active; owner full
create policy "merchant public read" on merchants for select using (is_active = true);
create policy "merchant owner write" on merchants for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- listings: public read active; merchant owner write
create policy "listing public read" on listings for select using (status = 'active');
create policy "listing owner write" on listings for all
  using (merchant_id in (select id from merchants where owner_id = auth.uid()))
  with check (merchant_id in (select id from merchants where owner_id = auth.uid()));

-- orders: consumer sees own; merchant sees own-store orders
create policy "order consumer read" on orders for select using (consumer_id = auth.uid());
create policy "order consumer insert" on orders for insert with check (consumer_id = auth.uid());
create policy "order merchant read" on orders for select
  using (merchant_id in (select id from merchants where owner_id = auth.uid()));

-- payouts: merchant sees own
create policy "payout owner read" on payouts for select
  using (merchant_id in (select id from merchants where owner_id = auth.uid()));

-- audit: admin only
create policy "audit admin read" on admin_audit_log for select
  using (exists(select 1 from profiles where id = auth.uid() and role = 'admin'));
```

- [ ] **Step 2: Apply**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npx supabase db reset
```

Expected: RLS enabled, all policies created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000002_rls.sql
git commit -m "feat(db): row level security policies"
```

### Task 1.4: Storage buckets

**Files:**
- Create: `supabase/migrations/00000000000003_storage.sql`

- [ ] **Step 1: Write storage migration**

```sql
-- ============================================================================
-- Storage buckets
-- ============================================================================

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('merchant-logos', 'merchant-logos', true),
  ('food-photos', 'food-photos', true);

-- avatar: anyone authenticated can upload to own folder
create policy "avatar upload own" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatar public read" on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- merchant-logos: owner only
create policy "merchant logo upload" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'merchant-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "merchant logo public read" on storage.objects for select
  to public
  using (bucket_id = 'merchant-logos');

-- food-photos: merchant owner
create policy "food photo upload" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'food-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "food photo public read" on storage.objects for select
  to public
  using (bucket_id = 'food-photos');
```

- [ ] **Step 2: Apply + commit**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npx supabase db reset
git add supabase/migrations/00000000000003_storage.sql
git commit -m "feat(db): storage buckets (avatars, logos, food-photos)"
```

### Task 1.5: Realtime publication

**Files:**
- Create: `supabase/migrations/00000000000004_realtime.sql`

- [ ] **Step 1: Add orders + listings to realtime**

```sql
-- ============================================================================
-- Realtime
-- ============================================================================

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.listings;
```

- [ ] **Step 2: Apply + commit**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npx supabase db reset
git add supabase/migrations/00000000000004_realtime.sql
git commit -m "feat(db): enable realtime on orders and listings"
```

### Task 1.6: Seed dev data

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write seed**

```sql
-- ============================================================================
-- Dev seed (test users only)
-- ============================================================================

-- Note: real users must be created via auth.users; this seeds the profile rows
-- assuming you create matching auth users manually in Studio with these UUIDs.

insert into profiles (id, role, full_name, phone) values
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Admin SaveBites', '+6281234567890'),
  ('00000000-0000-0000-0000-000000000002', 'merchant', 'Pemilik Warung Nasi', '+6281234567891'),
  ('00000000-0000-0000-0000-000000000003', 'consumer', 'Budi Pembeli', '+6281234567892')
on conflict (id) do nothing;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/seed.sql
git commit -m "chore(db): dev seed profiles"
```

---

## Phase 2 — Supabase Clients + Middleware

### Task 2.1: Supabase browser client

**Files:**
- Create: `lib/supabase/client.ts`

- [ ] **Step 1: Write client**

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/client.ts
git commit -m "feat(supabase): browser client"
```

### Task 2.2: Supabase server client (RSC + Route Handler)

**Files:**
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Write server client**

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch { /* Server Component: ignore */ }
        },
      },
    },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/server.ts
git commit -m "feat(supabase): server client (cookies adapter)"
```

### Task 2.3: Supabase service-role client (server-only)

**Files:**
- Create: `lib/supabase/admin.ts`

- [ ] **Step 1: Write admin client**

```ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/admin.ts
git commit -m "feat(supabase): service-role admin client"
```

### Task 2.4: Middleware (session refresh + route protection)

**Files:**
- Create: `middleware.ts`, `lib/supabase/middleware.ts`

- [ ] **Step 1: Write `lib/supabase/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ratelimit } from '@/lib/ratelimit';

const PUBLIC_PATHS = ['/', '/login', '/register', '/auth/callback', '/api/midtrans/webhook'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }

  // soft per-IP rate limit
  if (path.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') ?? 'anon';
    const { success } = await ratelimit.limit(`api:${ip}`);
    if (!success) return new NextResponse('Too many requests', { status: 429 });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

- [ ] **Step 2: Write `lib/ratelimit.ts`**

```ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

export const ratelimit = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1 m') })
  : { limit: async () => ({ success: true, remaining: 60, reset: 0, limit: 60 }) } as never;
```

- [ ] **Step 3: Write `middleware.ts`**

```ts
export { middleware, config } from '@/lib/supabase/middleware';
```

- [ ] **Step 4: Commit**

```bash
git add middleware.ts lib/supabase/middleware.ts lib/ratelimit.ts
git commit -m "feat(middleware): session refresh + auth guard + api rate limit"
```

### Task 2.5: Shared types + zod schemas

**Files:**
- Create: `lib/db/types.ts`, `lib/validations/auth.ts`, `lib/validations/listing.ts`, `lib/validations/order.ts`

- [ ] **Step 1: Write `lib/db/types.ts`**

```ts
export type UserRole = 'consumer' | 'merchant' | 'admin';
export type OrderStatus = 'paid' | 'picked_up' | 'expired' | 'cancelled' | 'refunded';
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';
export type ListingStatus = 'active' | 'sold_out' | 'expired' | 'cancelled';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Merchant {
  id: string;
  owner_id: string;
  store_name: string;
  address: string;
  lat: number;
  lng: number;
  cuisine_type: string | null;
  logo_url: string | null;
  is_active: boolean;
  distance_m?: number;
}

export interface Listing {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  original_price: number;
  discount_percent: number;
  final_price: number;
  stock: number;
  pickup_start: string;
  pickup_end: string;
  status: ListingStatus;
  created_at: string;
  merchant?: Pick<Merchant, 'id' | 'store_name' | 'address' | 'lat' | 'lng' | 'logo_url' | 'distance_m'>;
}

export interface Order {
  id: string;
  order_number: string;
  consumer_id: string;
  listing_id: string;
  merchant_id: string;
  quantity: number;
  total_price: number;
  status: OrderStatus;
  qr_code: string;
  pickup_code: string;
  pickup_start: string;
  pickup_end: string;
  midtrans_transaction_id: string | null;
  paid_at: string;
  picked_up_at: string | null;
  created_at: string;
  listing?: Pick<Listing, 'title' | 'photo_url'>;
  merchant?: Pick<Merchant, 'store_name' | 'address'>;
}

export interface Payout {
  id: string;
  merchant_id: string;
  period_date: string;
  order_count: number;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  status: PayoutStatus;
  paid_at: string | null;
  transfer_reference: string | null;
}
```

- [ ] **Step 2: Write `lib/validations/auth.ts`**

```ts
import { z } from 'zod';

export const phoneRegex = /^\+?[0-9]{8,15}$/;

export const registerSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Minimal 8 karakter'),
  full_name: z.string().min(2, 'Minimal 2 karakter').max(80),
  phone: z.string().regex(phoneRegex, 'Format: +6281234567890').optional().or(z.literal('')),
  role: z.enum(['consumer', 'merchant']),
});

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Wajib diisi'),
});

export const merchantOnboardingSchema = z.object({
  store_name: z.string().min(2).max(80),
  address: z.string().min(5).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  cuisine_type: z.string().max(40).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MerchantOnboardingInput = z.infer<typeof merchantOnboardingSchema>;
```

- [ ] **Step 3: Write `lib/validations/listing.ts`**

```ts
import { z } from 'zod';

export const createListingSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  original_price: z.number().int().positive().max(10_000_000),
  discount_percent: z.number().int().min(50).max(70),
  stock: z.number().int().positive().max(999),
  pickup_start: z.string().datetime(),
  pickup_end: z.string().datetime(),
  photo_url: z.string().url().optional(),
}).refine(d => new Date(d.pickup_end) > new Date(d.pickup_start), {
  message: 'pickup_end harus setelah pickup_start',
  path: ['pickup_end'],
});

export type CreateListingInput = z.infer<typeof createListingSchema>;
```

- [ ] **Step 4: Write `lib/validations/order.ts`**

```ts
import { z } from 'zod';

export const createOrderSchema = z.object({
  listing_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
```

- [ ] **Step 5: Commit**

```bash
git add lib/db/types.ts lib/validations
git commit -m "feat(types): shared db types + zod schemas"
```

### Task 2.6: Unit tests for validations

**Files:**
- Create: `vitest.config.ts`, `lib/validations/__tests__/auth.test.ts`, `lib/validations/__tests__/listing.test.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: { environment: 'node', include: ['**/*.test.ts', '**/*.test.tsx'] },
  resolve: { alias: { '@': path.resolve(__dirname) } },
});
```

- [ ] **Step 2: Write `lib/validations/__tests__/auth.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, merchantOnboardingSchema } from '../auth';

describe('registerSchema', () => {
  it('accepts valid consumer input', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com', password: 'password123', full_name: 'Budi', role: 'consumer',
    });
    expect(r.success).toBe(true);
  });
  it('rejects bad phone', () => {
    const r = registerSchema.safeParse({
      email: 'a@b.com', password: 'password123', full_name: 'Budi',
      phone: 'abc', role: 'consumer',
    });
    expect(r.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires password', () => {
    const r = loginSchema.safeParse({ email: 'a@b.com', password: '' });
    expect(r.success).toBe(false);
  });
});

describe('merchantOnboardingSchema', () => {
  it('accepts valid coords', () => {
    const r = merchantOnboardingSchema.safeParse({
      store_name: 'Warung Nasi', address: 'Jl. Merdeka 1',
      lat: -6.2, lng: 106.8,
    });
    expect(r.success).toBe(true);
  });
  it('rejects out-of-range lat', () => {
    const r = merchantOnboardingSchema.safeParse({
      store_name: 'X', address: 'Y', lat: 999, lng: 0,
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 3: Write `lib/validations/__tests__/listing.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createListingSchema } from '../listing';

describe('createListingSchema', () => {
  it('accepts valid listing', () => {
    const r = createListingSchema.safeParse({
      title: 'Nasi Goreng', original_price: 50000, discount_percent: 60,
      stock: 5, pickup_start: '2026-06-17T10:00:00Z', pickup_end: '2026-06-17T21:00:00Z',
    });
    expect(r.success).toBe(true);
  });
  it('rejects discount < 50', () => {
    const r = createListingSchema.safeParse({
      title: 'Nasi', original_price: 50000, discount_percent: 30,
      stock: 1, pickup_start: '2026-06-17T10:00:00Z', pickup_end: '2026-06-17T21:00:00Z',
    });
    expect(r.success).toBe(false);
  });
  it('rejects pickup_end before pickup_start', () => {
    const r = createListingSchema.safeParse({
      title: 'Nasi', original_price: 50000, discount_percent: 60,
      stock: 1, pickup_start: '2026-06-17T21:00:00Z', pickup_end: '2026-06-17T10:00:00Z',
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 4: Run tests**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts lib/validations/__tests__
git commit -m "test(validations): unit tests for auth + listing schemas"
```

---

## Phase 3 — Auth (Email/Password, Consumer + Merchant + Admin)

### Task 3.1: Auth server actions

**Files:**
- Create: `app/(auth)/actions.ts`

- [ ] **Step 1: Write `app/(auth)/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { registerSchema, loginSchema, merchantOnboardingSchema } from '@/lib/validations/auth';
import { headers } from 'next/headers';

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    full_name: formData.get('full_name'),
    phone: formData.get('phone') || undefined,
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const { email, password, full_name, phone, role } = parsed.data;

  const supabase = await createClient();
  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL!;

  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: 'Pendaftaran gagal' };

  const admin = createAdminClient();
  const { error: pErr } = await admin.from('profiles').insert({
    id: data.user.id, role, full_name, phone: phone || null,
  });
  if (pErr) return { error: pErr.message };

  if (role === 'merchant') {
    const { error: mErr } = await admin.from('merchants').insert({
      owner_id: data.user.id, store_name: full_name, address: '',
      location: `SRID=4326;POINT(0 0)`, is_active: false,
    });
    if (mErr) return { error: mErr.message };
    redirect('/onboarding/merchant');
  }
  redirect('/');
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: 'Email atau kata sandi salah' };
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function completeMerchantOnboardingAction(formData: FormData) {
  const parsed = merchantOnboardingSchema.safeParse({
    store_name: formData.get('store_name'),
    address: formData.get('address'),
    lat: Number(formData.get('lat')),
    lng: Number(formData.get('lng')),
    cuisine_type: formData.get('cuisine_type') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase.from('merchants').update({
    store_name: parsed.data.store_name,
    address: parsed.data.address,
    location: `SRID=4326;POINT(${parsed.data.lng} ${parsed.data.lat})`,
    cuisine_type: parsed.data.cuisine_type ?? null,
    is_active: true,
  }).eq('owner_id', user.id);
  if (error) return { error: error.message };
  redirect('/merchant');
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/actions.ts
git commit -m "feat(auth): server actions (register, login, logout, merchant onboarding)"
```

### Task 3.2: Login page

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/login/form.tsx`, `app/(auth)/layout.tsx`

- [ ] **Step 1: Write `app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-brand-600">SaveBites</h1>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Write `app/(auth)/login/page.tsx`**

```tsx
import { LoginForm } from './form';

export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <LoginForm />;
}
```

- [ ] **Step 3: Write `app/(auth)/login/form.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loginAction } from '../actions';

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const r = await loginAction(fd);
          if (r?.error) setError(r.error);
          else router.push('/');
        });
      }}
      className="space-y-4"
    >
      <h2 className="text-xl font-semibold">Masuk</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className="block text-sm">Email</label>
        <input name="email" type="email" required className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Kata Sandi</label>
        <input name="password" type="password" required className="w-full rounded border px-3 py-2" />
      </div>
      <button disabled={pending} className="w-full rounded bg-brand-600 py-2 text-white">
        {pending ? 'Memproses…' : 'Masuk'}
      </button>
      <p className="text-sm">
        Belum punya akun? <Link href="/register" className="text-brand-600 underline">Daftar</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\)/login app/\(auth\)/layout.tsx
git commit -m "feat(auth): login page + form"
```

### Task 3.3: Register page

**Files:**
- Create: `app/(auth)/register/page.tsx`, `app/(auth)/register/form.tsx`

- [ ] **Step 1: Write `app/(auth)/register/page.tsx`**

```tsx
import { RegisterForm } from './form';
export default function RegisterPage() { return <RegisterForm />; }
```

- [ ] **Step 2: Write `app/(auth)/register/form.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { registerAction } from '../actions';

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const r = await registerAction(fd);
          if (r?.error) setError(r.error);
        });
      }}
      className="space-y-4"
    >
      <h2 className="text-xl font-semibold">Daftar</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className="block text-sm">Nama Lengkap</label>
        <input name="full_name" required minLength={2} maxLength={80} className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Email</label>
        <input name="email" type="email" required className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Kata Sandi (min. 8)</label>
        <input name="password" type="password" required minLength={8} className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">No. HP (opsional, format +62…)</label>
        <input name="phone" pattern="^\+?[0-9]{8,15}$" placeholder="+6281234567890" className="w-full rounded border px-3 py-2" />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm">Daftar sebagai</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="consumer" defaultChecked /> Pembeli
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="role" value="merchant" /> Penjual (Resto/Warung)
        </label>
      </fieldset>
      <button disabled={pending} className="w-full rounded bg-brand-600 py-2 text-white">
        {pending ? 'Membuat akun…' : 'Daftar'}
      </button>
      <p className="text-sm">
        Sudah punya akun? <Link href="/login" className="text-brand-600 underline">Masuk</Link>
      </p>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/register
git commit -m "feat(auth): register page + form"
```

### Task 3.4: Email confirmation callback

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Write callback route**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/auth/callback
git commit -m "feat(auth): email confirmation callback"
```

### Task 3.5: Merchant onboarding page

**Files:**
- Create: `app/onboarding/merchant/page.tsx`, `app/onboarding/merchant/form.tsx`

- [ ] **Step 1: Write `app/onboarding/merchant/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MerchantOnboardingForm } from './form';

export default async function MerchantOnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <MerchantOnboardingForm />;
}
```

- [ ] **Step 2: Write `app/onboarding/merchant/form.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { completeMerchantOnboardingAction } from '@/app/(auth)/actions';

export function MerchantOnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) return setError('Browser tidak mendukung GPS');
    navigator.geolocation.getCurrentPosition(
      pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError('Gagal deteksi lokasi, isi manual'),
    );
  };

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (coords) { fd.set('lat', String(coords.lat)); fd.set('lng', String(coords.lng)); }
        startTransition(async () => {
          const r = await completeMerchantOnboardingAction(fd);
          if (r?.error) setError(r.error);
        });
      }}
      className="space-y-4"
    >
      <h2 className="text-xl font-semibold">Lengkapi Data Toko</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className="block text-sm">Nama Toko</label>
        <input name="store_name" required minLength={2} maxLength={80} className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Alamat</label>
        <textarea name="address" required minLength={5} maxLength={200} className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Jenis Masakan (opsional)</label>
        <input name="cuisine_type" maxLength={40} className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Lokasi (Lat, Lng)</label>
        <div className="flex gap-2">
          <input name="lat" type="number" step="any" required value={coords?.lat ?? ''} className="w-full rounded border px-3 py-2" placeholder="-6.2" />
          <input name="lng" type="number" step="any" required value={coords?.lng ?? ''} className="w-full rounded border px-3 py-2" placeholder="106.8" />
        </div>
        <button type="button" onClick={detectLocation} className="mt-2 text-sm text-brand-600 underline">Deteksi otomatis</button>
      </div>
      <button disabled={pending} className="w-full rounded bg-brand-600 py-2 text-white">
        {pending ? 'Menyimpan…' : 'Selesaikan'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/onboarding/merchant
git commit -m "feat(merchant): onboarding page with GPS detect"
```

---

## Phase 4 — Discovery (Consumer Home)

### Task 4.1: Location store (zustand)

**Files:**
- Create: `lib/stores/location.ts`

- [ ] **Step 1: Write store**

```ts
'use client';

import { create } from 'zustand';

interface LocationState {
  lat: number | null;
  lng: number | null;
  setLocation: (lat: number, lng: number) => void;
}

export const useLocation = create<LocationState>(set => ({
  lat: null, lng: null,
  setLocation: (lat, lng) => set({ lat, lng }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add lib/stores/location.ts
git commit -m "feat(state): zustand location store"
```

### Task 4.2: Discovery query helper (PostGIS haversine)

**Files:**
- Create: `lib/db/queries.ts`

- [ ] **Step 1: Write `lib/db/queries.ts`**

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Listing, Merchant } from '@/lib/db/types';

export async function getNearbyListings(lat: number, lng: number, radiusKm = 2) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('nearby_listings', {
    p_lat: lat, p_lng: lng, p_radius_m: radiusKm * 1000,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as (Listing & { distance_m: number; merchant: Merchant })[];
}

export async function getListingById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('listings')
    .select('*, merchant:merchants(id, store_name, address, logo_url)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Listing | null;
}
```

- [ ] **Step 2: Write `supabase/migrations/00000000000005_nearby_rpc.sql`**

```sql
create or replace function nearby_listings(p_lat double precision, p_lng double precision, p_radius_m double precision)
returns table (
  id uuid, merchant_id uuid, title text, description text,
  original_price integer, discount_percent integer, final_price integer,
  stock integer, pickup_start timestamptz, pickup_end timestamptz,
  status text, created_at timestamptz,
  distance_m double precision,
  m_id uuid, m_store_name text, m_address text, m_logo_url text
) language sql stable as $$
  select
    l.id, l.merchant_id, l.title, l.description,
    l.original_price, l.discount_percent, l.final_price,
    l.stock, l.pickup_start, l.pickup_end,
    l.status, l.created_at,
    st_distance(m.location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography) as distance_m,
    m.id as m_id, m.store_name as m_store_name, m.address as m_address, m.logo_url as m_logo_url
  from listings l
  join merchants m on m.id = l.merchant_id
  where l.status = 'active'
    and m.is_active = true
    and l.pickup_end > now()
    and st_dwithin(
      m.location,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
  order by distance_m asc
  limit 100;
$$;
```

- [ ] **Step 3: Apply + commit**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npx supabase db reset
git add supabase/migrations/00000000000005_nearby_rpc.sql lib/db/queries.ts
git commit -m "feat(db,query): nearby_listings RPC + server query"
```

### Task 4.3: Consumer home page (discovery)

**Files:**
- Create: `app/(consumer)/layout.tsx`, `app/(consumer)/page.tsx`, `app/(consumer)/discovery-client.tsx`, `app/(consumer)/listing/[id]/page.tsx`

- [ ] **Step 1: Write `app/(consumer)/layout.tsx`**

```tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ConsumerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return (
    <div>
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link href="/" className="text-lg font-bold text-brand-600">SaveBites</Link>
          <form action="/api/auth/logout" method="post">
            <button className="text-sm text-slate-600">Keluar</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/(consumer)/page.tsx`**

```tsx
import { DiscoveryClient } from './discovery-client';

export default function HomePage() {
  return <DiscoveryClient />;
}
```

- [ ] **Step 3: Write `app/(consumer)/discovery-client.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocation } from '@/lib/stores/location';
import { formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface NearbyListing {
  id: string;
  title: string;
  original_price: number;
  discount_percent: number;
  final_price: number;
  pickup_end: string;
  distance_m: number;
  merchant: { store_name: string; logo_url: string | null };
}

export function DiscoveryClient() {
  const { lat, lng, setLocation } = useLocation();
  const [listings, setListings] = useState<NearbyListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lat != null && lng != null) return;
    navigator.geolocation?.getCurrentPosition(
      p => setLocation(p.coords.latitude, p.coords.longitude),
      () => setError('Aktifkan GPS untuk lihat toko terdekat'),
    );
  }, [lat, lng, setLocation]);

  useEffect(() => {
    if (lat == null || lng == null) return;
    fetch(`/api/listings/nearby?lat=${lat}&lng=${lng}`)
      .then(r => r.json())
      .then(d => setListings(d.listings))
      .catch(() => setError('Gagal memuat listings'));
  }, [lat, lng]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (listings == null) return <p className="text-sm text-slate-500">Mencari toko terdekat…</p>;
  if (listings.length === 0) return <p className="text-sm text-slate-500">Tidak ada surplus makanan di sekitarmu saat ini.</p>;

  return (
    <ul className="space-y-3">
      {listings.map(l => (
        <li key={l.id} className="rounded-lg border p-3">
          <Link href={`/listing/${l.id}`} className="block">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{l.title}</p>
                <p className="text-xs text-slate-500">{l.merchant.store_name} · {(l.distance_m / 1000).toFixed(2)} km</p>
              </div>
              <div className="text-right">
                <p className="text-sm line-through text-slate-400">Rp {l.original_price.toLocaleString('id')}</p>
                <p className="font-bold text-brand-600">Rp {l.final_price.toLocaleString('id')}</p>
                <p className="text-xs text-slate-500">-{l.discount_percent}%</p>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-500">Ambil sebelum {formatDistanceToNow(new Date(l.pickup_end), { addSuffix: true, locale: idLocale })}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Write nearby API route**

Create `app/api/listings/nearby/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { getNearbyListings } from '@/lib/db/queries';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Invalid coords' }, { status: 400 });
  }
  try {
    const listings = await getNearbyListings(lat, lng);
    return NextResponse.json({ listings });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/\(consumer\) app/api/listings/nearby
git commit -m "feat(consumer): discovery home + nearby api"
```

### Task 4.4: Listing detail + order page

**Files:**
- Create: `app/(consumer)/listing/[id]/page.tsx`, `app/(consumer)/listing/[id]/order-button.tsx`

- [ ] **Step 1: Write `app/(consumer)/listing/[id]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { getListingById } from '@/lib/db/queries';
import { OrderButton } from './order-button';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing || listing.status !== 'active') notFound();

  return (
    <article className="space-y-4">
      <h1 className="text-2xl font-bold">{listing.title}</h1>
      <p className="text-slate-600">{listing.merchant?.store_name} · {listing.merchant?.address}</p>
      {listing.description && <p>{listing.description}</p>}
      <div className="rounded-lg border p-4">
        <p className="text-sm line-through text-slate-400">Rp {listing.original_price.toLocaleString('id')}</p>
        <p className="text-2xl font-bold text-brand-600">Rp {listing.final_price.toLocaleString('id')}</p>
        <p className="text-sm text-slate-500">Diskon {listing.discount_percent}% · Stok: {listing.stock}</p>
      </div>
      <p className="text-sm">
        Ambil: {format(new Date(listing.pickup_start), 'HH:mm', { locale: idLocale })}–
        {format(new Date(listing.pickup_end), 'HH:mm', { locale: idLocale })} WIB
      </p>
      <OrderButton listingId={listing.id} maxStock={listing.stock} />
    </article>
  );
}
```

- [ ] **Step 2: Write `app/(consumer)/listing/[id]/order-button.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOrderAction } from '@/app/(consumer)/orders/actions';

export function OrderButton({ listingId, maxStock }: { listingId: string; maxStock: number }) {
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm">Jumlah</label>
        <input
          type="number" min={1} max={Math.min(maxStock, 10)} value={qty}
          onChange={e => setQty(Number(e.target.value))}
          className="w-24 rounded border px-3 py-2"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await createOrderAction({ listing_id: listingId, quantity: qty });
            if (r.error) return setError(r.error);
            router.push(`/orders/${r.orderId}/pay`);
          });
        }}
        className="w-full rounded bg-brand-600 py-3 font-semibold text-white"
      >
        {pending ? 'Membuat pesanan…' : 'Pesan & Bayar'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(consumer\)/listing
git commit -m "feat(consumer): listing detail + order button"
```

---

## Phase 5 — Orders + Midtrans Payment

### Task 5.1: Order server actions

**Files:**
- Create: `app/(consumer)/orders/actions.ts`, `lib/midtrans.ts`

- [ ] **Step 1: Write `lib/midtrans.ts`**

```ts
import 'server-only';
import Midtrans from 'midtrans-client';

export const snap = new Midtrans.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});

export const core = new Midtrans.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});
```

- [ ] **Step 2: Write `app/(consumer)/orders/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createOrderSchema } from '@/lib/validations/order';
import { snap } from '@/lib/midtrans';
import { nanoid } from 'nanoid';

export async function createOrderAction(input: unknown) {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid input' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // 1. fetch listing
  const { data: listing } = await supabase
    .from('listings')
    .select('*, merchant:merchants(id)')
    .eq('id', parsed.data.listing_id)
    .single();
  if (!listing || listing.status !== 'active') return { error: 'Listing tidak aktif' };
  if (listing.stock < parsed.data.quantity) return { error: 'Stok tidak cukup' };

  // 2. atomic stock decrement
  const { data: decremented } = await supabase.rpc('decrement_listing_stock', {
    p_listing_id: listing.id, p_qty: parsed.data.quantity,
  });
  if (!decremented) return { error: 'Stok habis, coba lagi' };

  // 3. create order
  const qrCode = nanoid(24);
  const pickupCode = qrCode.slice(0, 6).toUpperCase();
  const total = listing.final_price * parsed.data.quantity;

  const { data: order, error } = await supabase.from('orders').insert({
    consumer_id: user.id,
    listing_id: listing.id,
    merchant_id: listing.merchant.id,
    quantity: parsed.data.quantity,
    total_price: total,
    qr_code: qrCode,
    pickup_code: pickupCode,
    pickup_start: listing.pickup_start,
    pickup_end: listing.pickup_end,
  }).select('id, order_number').single();
  if (error || !order) {
    // best-effort restore stock
    await supabase.rpc('decrement_listing_stock', { p_listing_id: listing.id, p_qty: -parsed.data.quantity });
    return { error: error?.message ?? 'Gagal membuat pesanan' };
  }

  // 4. create midtrans transaction
  const trx = await snap.createTransaction({
    transaction_details: { order_id: order.order_number, gross_amount: total },
    customer_details: { email: user.email!, first_name: user.user_metadata?.full_name ?? 'User' },
    item_details: [{
      id: listing.id, price: listing.final_price, quantity: parsed.data.quantity,
      name: listing.title,
    }],
  });

  return { orderId: order.id, snapToken: trx.token, snapRedirectUrl: trx.redirect_url };
}

export async function getSnapTokenAction(orderId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { data: order } = await supabase
    .from('orders').select('id, order_number, total_price, status')
    .eq('id', orderId).eq('consumer_id', user.id).single();
  if (!order) return { error: 'Order not found' };
  if (order.status !== 'paid') return { error: 'Order not in paid state' };

  const trx = await snap.createTransaction({
    transaction_details: { order_id: order.order_number, gross_amount: order.total_price },
  });
  return { snapToken: trx.token, snapRedirectUrl: trx.redirect_url };
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/midtrans.ts app/\(consumer\)/orders/actions.ts
git commit -m "feat(orders): create order action + midtrans snap integration"
```

### Task 5.2: Pay page (loads Snap)

**Files:**
- Create: `app/(consumer)/orders/[id]/pay/page.tsx`, `app/(consumer)/orders/[id]/pay/snap-loader.tsx`

- [ ] **Step 1: Write `app/(consumer)/orders/[id]/pay/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SnapLoader } from './snap-loader';

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: order } = await supabase
    .from('orders').select('id, order_number, total_price, status')
    .eq('id', id).eq('consumer_id', user.id).single();
  if (!order) redirect('/');
  return <SnapLoader orderId={order.id} status={order.status} />;
}
```

- [ ] **Step 2: Write `app/(consumer)/orders/[id]/pay/snap-loader.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { getSnapTokenAction } from '../../actions';

declare global { interface Window { snap?: { pay: (token: string, opts: unknown) => void } } }

export function SnapLoader({ orderId, status }: { orderId: string; status: string }) {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (status === 'picked_up' || status === 'cancelled' || status === 'refunded') {
      router.replace(`/orders/${orderId}`);
    }
  }, [status, orderId, router]);

  const launch = async () => {
    if (!window.snap) return setError('Midtrans belum siap, coba lagi');
    const r = await getSnapTokenAction(orderId);
    if (r.error || !r.snapToken) return setError(r.error ?? 'Gagal dapat token');
    window.snap.pay(r.snapToken, {
      onSuccess: () => router.replace(`/orders/${orderId}`),
      onPending: () => router.replace(`/orders/${orderId}?pending=1`),
      onError: () => setError('Pembayaran gagal'),
      onClose: () => setError('Popup ditutup, klik lagi untuk bayar'),
    });
  };

  return (
    <div className="space-y-4">
      <Script src="https://app.sandbox.midtrans.com/snap/snap.js"
              data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
              strategy="lazyOnload" />
      <h1 className="text-xl font-semibold">Selesaikan Pembayaran</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={launch} className="w-full rounded bg-brand-600 py-3 text-white">
        Bayar Sekarang
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(consumer\)/orders
git commit -m "feat(payment): snap loader pay page"
```

### Task 5.3: Midtrans webhook (settlement)

**Files:**
- Create: `app/api/midtrans/webhook/route.ts`

- [ ] **Step 1: Write webhook**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { core } from '@/lib/midtrans';
import crypto from 'node:crypto';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { order_id, transaction_id, transaction_status, payment_type, status_code, gross_amount, signature_key } = body;

  // 1. verify signature
  const expected = crypto
    .createHash('sha512')
    .update(order_id + status_code + gross_amount + process.env.MIDTRANS_SERVER_KEY)
    .digest('hex');
  if (expected !== signature_key) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 403 });
  }

  // 2. acknowledge to midtrans to confirm receipt
  try { await core.transaction.notification(body); } catch { /* ignore */ }

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders').select('id, status')
    .eq('order_number', order_id).single();
  if (!order) return NextResponse.json({ ok: true });
  if (order.status === 'picked_up' || order.status === 'cancelled') return NextResponse.json({ ok: true });

  let newStatus: 'paid' | 'expired' | 'cancelled' | null = null;
  if (['capture', 'settlement'].includes(transaction_status) && (payment_type !== 'credit_card' || body.fraud_status === 'accept')) {
    newStatus = 'paid';
  } else if (['deny', 'cancel', 'failure'].includes(transaction_status)) {
    newStatus = 'cancelled';
  } else if (transaction_status === 'expire') {
    newStatus = 'expired';
  }

  if (newStatus) {
    await admin.from('orders').update({
      status: newStatus,
      midtrans_transaction_id: transaction_id ?? null,
      midtrans_payment_type: payment_type ?? null,
    }).eq('id', order.id);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/midtrans/webhook
git commit -m "feat(payment): midtrans webhook with signature verify"
```

---

## Phase 6 — Consumer Order Page + QR Ticket

### Task 6.1: Order detail page

**Files:**
- Create: `app/(consumer)/orders/[id]/page.tsx`, `lib/qr.ts`

- [ ] **Step 1: Write `lib/qr.ts` (URL generator)**

```ts
export function qrUrl(data: string, size = 240) {
  const enc = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${enc}`;
}
```

- [ ] **Step 2: Write `app/(consumer)/orders/[id]/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { qrUrl } from '@/lib/qr';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { CountdownTimer } from './countdown';

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: order } = await supabase
    .from('orders')
    .select('*, listing:listings(title), merchant:merchants(store_name, address)')
    .eq('id', id).eq('consumer_id', user.id).single();
  if (!order) redirect('/');

  if (order.status === 'paid') {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">Tiket Pickup</h1>
        <CountdownTimer pickupEnd={order.pickup_end} />
        <img src={qrUrl(order.qr_code)} alt="QR" className="mx-auto rounded border bg-white p-2" />
        <p className="font-mono text-2xl tracking-widest">{order.pickup_code}</p>
        <p className="text-sm text-slate-500">
          {order.merchant?.store_name} · {order.merchant?.address}
        </p>
        <p className="text-sm">
          Tunjukkan QR & kode di atas ke kasir sebelum {format(new Date(order.pickup_end), 'HH:mm', { locale: idLocale })} WIB.
        </p>
      </div>
    );
  }

  if (order.status === 'picked_up') {
    return <p className="text-center">Pesanan sudah diambil. Terima kasih!</p>;
  }

  if (order.status === 'expired') {
    return <p className="text-center text-red-600">Waktu pickup habis. Dana tetap menjadi milik merchant (kompensasi no-show).</p>;
  }

  return <p className="text-center">Status: {order.status}</p>;
}
```

- [ ] **Step 3: Write `app/(consumer)/orders/[id]/countdown.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';

export function CountdownTimer({ pickupEnd }: { pickupEnd: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(pickupEnd).getTime();
  const diff = end - now;
  if (diff <= 0) return <p className="text-red-600">Waktu habis</p>;
  return (
    <p className="text-lg">
      Sisa waktu: <span className="font-mono font-semibold">{formatDistanceToNowStrict(end)}</span>
    </p>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/\(consumer\)/orders/\[id\]/page.tsx app/\(consumer\)/orders/\[id\]/countdown.tsx lib/qr.ts
git commit -m "feat(consumer): order detail page with QR ticket + countdown"
```

### Task 6.2: Logout API route

**Files:**
- Create: `app/api/auth/logout/route.ts`

- [ ] **Step 1: Write route**

```ts
import { NextResponse } from 'next/server';
import { logoutAction } from '@/app/(auth)/actions';

export async function POST() {
  await logoutAction();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/logout
git commit -m "feat(auth): logout api route"
```

---

## Phase 7 — Merchant Dashboard + QR Scan

### Task 7.1: Merchant layout + queue (realtime)

**Files:**
- Create: `app/merchant/layout.tsx`, `app/merchant/page.tsx`, `app/merchant/queue-client.tsx`

- [ ] **Step 1: Write `app/merchant/layout.tsx`**

```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase
    .from('profiles').select('role, merchant:merchants(id, store_name, is_active)')
    .eq('id', user.id).single();
  if (profile?.role !== 'merchant') redirect('/');

  return (
    <div>
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link href="/merchant" className="text-lg font-bold text-brand-600">
            {profile.merchant?.store_name ?? 'Merchant'}
          </Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/merchant" className="underline">Antrean</Link>
            <Link href="/merchant/listings/new" className="underline">+ Posting</Link>
            <form action="/api/auth/logout" method="post">
              <button>Keluar</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/merchant/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { QueueClient } from './queue-client';

export default async function MerchantQueuePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('owner_id', user.id).single();
  if (!merchant) redirect('/onboarding/merchant');
  return <QueueClient merchantId={merchant.id} />;
}
```

- [ ] **Step 3: Write `app/merchant/queue-client.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface QueueOrder {
  id: string;
  order_number: string;
  pickup_code: string;
  quantity: number;
  total_price: number;
  pickup_end: string;
  status: string;
  listing: { title: string } | null;
}

export function QueueClient({ merchantId }: { merchantId: string }) {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, pickup_code, quantity, total_price, pickup_end, status, listing:listings(title)')
        .eq('merchant_id', merchantId)
        .eq('status', 'paid')
        .order('pickup_end', { ascending: true });
      setOrders((data ?? []) as QueueOrder[]);
      setLoading(false);
    };
    load();

    const ch = supabase
      .channel('orders-queue')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${merchantId}` },
        () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [merchantId]);

  if (loading) return <p>Memuat antrean…</p>;
  if (orders.length === 0) return <p className="text-sm text-slate-500">Belum ada pesanan.</p>;

  return (
    <ul className="space-y-2">
      {orders.map(o => (
        <li key={o.id} className="rounded border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-lg">{o.pickup_code}</p>
              <p className="text-sm">{o.listing?.title} × {o.quantity}</p>
              <p className="text-xs text-slate-500">Order #{o.order_number}</p>
            </div>
            <div className="text-right">
              <p className="text-sm">Rp {o.total_price.toLocaleString('id')}</p>
              <p className="text-xs text-slate-500">s/d {format(new Date(o.pickup_end), 'HH:mm', { locale: idLocale })}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/merchant
git commit -m "feat(merchant): realtime order queue dashboard"
```

### Task 7.2: Create listing page

**Files:**
- Create: `app/merchant/listings/new/page.tsx`, `app/merchant/listings/new/form.tsx`, `app/merchant/listings/actions.ts`

- [ ] **Step 1: Write `app/merchant/listings/actions.ts`**

```ts
'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createListingSchema } from '@/lib/validations/listing';

export async function createListingAction(input: unknown) {
  const parsed = createListingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { data: merchant } = await supabase
    .from('merchants').select('id').eq('owner_id', user.id).single();
  if (!merchant) return { error: 'Lengkapi profil merchant dulu' };

  const { error } = await supabase.from('listings').insert({
    merchant_id: merchant.id,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    original_price: parsed.data.original_price,
    discount_percent: parsed.data.discount_percent,
    stock: parsed.data.stock,
    pickup_start: parsed.data.pickup_start,
    pickup_end: parsed.data.pickup_end,
  });
  if (error) return { error: error.message };
  revalidatePath('/merchant');
  redirect('/merchant');
}
```

- [ ] **Step 2: Write `app/merchant/listings/new/page.tsx`**

```tsx
import { NewListingForm } from './form';
export default function NewListingPage() { return <NewListingForm />; }
```

- [ ] **Step 3: Write `app/merchant/listings/new/form.tsx`**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { createListingAction } from '../actions';

function defaultEnd() {
  const d = new Date();
  d.setHours(21, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}
function defaultStart() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30);
  return d.toISOString().slice(0, 16);
}

export function NewListingForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const input = {
          title: fd.get('title'),
          description: fd.get('description') || undefined,
          original_price: Number(fd.get('original_price')),
          discount_percent: Number(fd.get('discount_percent')),
          stock: Number(fd.get('stock')),
          pickup_start: new Date(fd.get('pickup_start') as string).toISOString(),
          pickup_end: new Date(fd.get('pickup_end') as string).toISOString(),
        };
        startTransition(async () => {
          const r = await createListingAction(input);
          if (r?.error) setError(r.error);
        });
      }}
      className="space-y-3"
    >
      <h1 className="text-xl font-semibold">Posting Makanan Surplus</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className="block text-sm">Nama Makanan</label>
        <input name="title" required minLength={2} maxLength={80} className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Deskripsi (opsional)</label>
        <textarea name="description" maxLength={500} className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Harga Asli (Rp)</label>
        <input name="original_price" type="number" min={1000} required className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Diskon (%)</label>
        <input name="discount_percent" type="range" min={50} max={70} defaultValue={60} className="w-full" />
        <output className="text-sm">60%</output>
      </div>
      <div>
        <label className="block text-sm">Jumlah Porsi</label>
        <input name="stock" type="number" min={1} max={999} required className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Pickup Mulai</label>
        <input name="pickup_start" type="datetime-local" required defaultValue={defaultStart()} className="w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm">Pickup Selesai</label>
        <input name="pickup_end" type="datetime-local" required defaultValue={defaultEnd()} className="w-full rounded border px-3 py-2" />
      </div>
      <button disabled={pending} className="w-full rounded bg-brand-600 py-3 text-white">
        {pending ? 'Memposting…' : 'Posting'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/merchant/listings
git commit -m "feat(merchant): new listing form + action"
```

### Task 7.3: QR scanner page (pickup confirmation)

**Files:**
- Create: `app/merchant/scan/page.tsx`, `app/merchant/scan/scanner.tsx`, `app/merchant/orders/actions.ts`

- [ ] **Step 1: Write `app/merchant/orders/actions.ts`**

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function confirmPickupAction(qrCode: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: order } = await supabase
    .from('orders').select('id, status, merchant_id, merchant:merchants(owner_id)')
    .eq('qr_code', qrCode).single();
  if (!order) return { error: 'Tiket tidak ditemukan' };
  if (order.merchant?.owner_id !== user.id) return { error: 'Tiket bukan milik toko Anda' };
  if (order.status !== 'paid') return { error: `Pesanan berstatus ${order.status}` };

  const { error } = await supabase.from('orders').update({
    status: 'picked_up', picked_up_at: new Date().toISOString(),
  }).eq('id', order.id);
  if (error) return { error: error.message };
  revalidatePath('/merchant');
  return { ok: true };
}
```

- [ ] **Step 2: Write `app/merchant/scan/page.tsx`**

```tsx
import { Scanner } from './scanner';
export default function ScanPage() { return <Scanner />; }
```

- [ ] **Step 3: Write `app/merchant/scan/scanner.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { confirmPickupAction } from '../orders/actions';

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manual, setManual] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch { setMsg('Kamera tidak tersedia, gunakan input manual.'); }
    })();
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  const submit = async (code: string) => {
    if (!code) return;
    setMsg('Memvalidasi…');
    const r = await confirmPickupAction(code);
    setMsg(r.error ? `❌ ${r.error}` : '✅ Pesanan dikonfirmasi');
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Scan QR Pembeli</h1>
      <video ref={videoRef} autoPlay playsInline className="w-full rounded border" />
      <p className="text-xs text-slate-500">Atau masukkan kode pickup manual:</p>
      <div className="flex gap-2">
        <input value={manual} onChange={e => setManual(e.target.value.toUpperCase())}
               placeholder="ABC123" className="flex-1 rounded border px-3 py-2 font-mono" />
        <button onClick={() => submit(manual)} className="rounded bg-brand-600 px-4 py-2 text-white">Konfirmasi</button>
      </div>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/merchant/scan app/merchant/orders
git commit -m "feat(merchant): QR scan + pickup confirmation"
```

---

## Phase 8 — Cron Jobs (Expire Orders, T+1 Payouts)

### Task 8.1: Expire overdue orders (every 5 min)

**Files:**
- Create: `app/api/cron/expire-orders/route.ts`, `vercel.json`

- [ ] **Step 1: Write `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/cron/expire-orders", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/daily-payouts",  "schedule": "0 2 * * *" }
  ]
}
```

- [ ] **Step 2: Write expire route**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function authorized(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse('Unauthorized', { status: 401 });
  const admin = createAdminClient();
  const { data } = await admin.rpc('expire_overdue_orders');
  return NextResponse.json({ expired: data ?? 0 });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/expire-orders vercel.json
git commit -m "feat(cron): expire overdue orders (5-min)"
```

### Task 8.2: Daily payouts T+1 (09:00 WIB = 02:00 UTC)

**Files:**
- Create: `supabase/migrations/00000000000006_settle_fn.sql`, `app/api/cron/daily-payouts/route.ts`, `lib/payouts.ts`

- [ ] **Step 1: Write settlement fn migration**

```sql
create or replace function settle_daily_payouts(p_date date)
returns integer language plpgsql as $$
declare v_count int := 0;
begin
  with eligible as (
    select
      o.merchant_id,
      count(*) as order_count,
      sum(o.total_price)::int as gross,
      sum((o.total_price * 0.10)::int)::int as fee
    from orders o
    where o.status = 'picked_up'
      and date(o.picked_up_at at time zone 'Asia/Jakarta') = p_date
    group by o.merchant_id
  ),
  inserted as (
    insert into payouts (merchant_id, period_date, order_count, gross_amount, platform_fee, net_amount, status)
    select
      merchant_id, p_date, order_count, gross, fee, gross - fee, 'pending'
    from eligible
    on conflict (merchant_id, period_date) do nothing
    returning 1
  )
  select count(*) into v_count from inserted;
  return v_count;
end;
$$;
```

- [ ] **Step 2: Write payouts helper**

```ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { format } from 'date-fns-tz';

export async function settleYesterday() {
  const admin = createAdminClient();
  const yesterdayJakarta = format(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
    'yyyy-MM-dd',
    { timeZone: 'Asia/Jakarta' },
  );
  const { data } = await admin.rpc('settle_daily_payouts', { p_date: yesterdayJakarta });
  return { settled: data ?? 0, date: yesterdayJakarta };
}

export async function markPayoutsPaid() {
  // no-op stub for v3: actual bank transfer integration is v4
  // admin marks rows paid in Supabase Studio after manual transfer
  return { ok: true };
}
```

- [ ] **Step 3: Write daily payouts route**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { settleYesterday, markPayoutsPaid } from '@/lib/payouts';

function authorized(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse('Unauthorized', { status: 401 });
  const r = await settleYesterday();
  await markPayoutsPaid();
  return NextResponse.json(r);
}
```

- [ ] **Step 4: Apply + commit**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npx supabase db reset
git add supabase/migrations/00000000000006_settle_fn.sql lib/payouts.ts app/api/cron/daily-payouts
git commit -m "feat(cron): T+1 payout settlement (09:00 WIB)"
```

---

## Phase 9 — Admin Dashboard

### Task 9.1: Admin layout + overview

**Files:**
- Create: `app/admin/layout.tsx`, `app/admin/page.tsx`

- [ ] **Step 1: Write `app/admin/layout.tsx`**

```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/');
  return (
    <div>
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <span className="text-lg font-bold text-brand-600">SaveBites Admin</span>
          <nav className="flex gap-3 text-sm">
            <Link href="/admin" className="underline">Overview</Link>
            <Link href="/admin/users" className="underline">Users</Link>
            <Link href="/admin/payouts" className="underline">Payouts</Link>
            <form action="/api/auth/logout" method="post"><button>Keluar</button></form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/admin/page.tsx`**

```tsx
import { createAdminClient } from '@/lib/supabase/admin';

export default async function AdminOverview() {
  const admin = createAdminClient();
  const [{ count: userCount }, { count: merchantCount }, { count: listingCount }, { count: orderCount }] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('merchants').select('*', { count: 'exact', head: true }),
    admin.from('listings').select('*', { count: 'exact', head: true }),
    admin.from('orders').select('*', { count: 'exact', head: true }),
  ]);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Users" value={userCount ?? 0} />
        <Stat label="Merchants" value={merchantCount ?? 0} />
        <Stat label="Listings" value={listingCount ?? 0} />
        <Stat label="Orders" value={orderCount ?? 0} />
      </div>
      <p className="text-sm text-slate-500">
        Untuk refund/payout, gunakan Supabase Studio. (Sengaja tanpa in-app flow di v3.)
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/layout.tsx app/admin/page.tsx
git commit -m "feat(admin): layout + overview stats"
```

### Task 9.2: Admin users + payouts list

**Files:**
- Create: `app/admin/users/page.tsx`, `app/admin/payouts/page.tsx`

- [ ] **Step 1: Write `app/admin/users/page.tsx`**

```tsx
import { createAdminClient } from '@/lib/supabase/admin';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default async function AdminUsersPage() {
  const admin = createAdminClient();
  const { data: users } = await admin
    .from('profiles').select('id, role, full_name, phone, created_at')
    .order('created_at', { ascending: false }).limit(100);
  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Users</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-slate-500"><th>Nama</th><th>Role</th><th>Phone</th><th>Sejak</th></tr></thead>
        <tbody>
          {(users ?? []).map(u => (
            <tr key={u.id} className="border-t">
              <td className="py-2">{u.full_name}</td>
              <td>{u.role}</td>
              <td>{u.phone ?? '—'}</td>
              <td>{format(new Date(u.created_at), 'd MMM yyyy', { locale: idLocale })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/admin/payouts/page.tsx`**

```tsx
import { createAdminClient } from '@/lib/supabase/admin';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

export default async function AdminPayoutsPage() {
  const admin = createAdminClient();
  const { data: payouts } = await admin
    .from('payouts').select('*, merchant:merchants(store_name)')
    .order('period_date', { ascending: false }).limit(50);
  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Payouts</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs text-slate-500"><th>Merchant</th><th>Period</th><th>Orders</th><th>Net</th><th>Status</th></tr></thead>
        <tbody>
          {(payouts ?? []).map(p => (
            <tr key={p.id} className="border-t">
              <td className="py-2">{p.merchant?.store_name}</td>
              <td>{p.period_date}</td>
              <td>{p.order_count}</td>
              <td>Rp {p.net_amount.toLocaleString('id')}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-500">
        Tandai <code>paid</code> via Supabase Studio setelah transfer manual.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/users app/admin/payouts
git commit -m "feat(admin): users + payouts list"
```

---

## Phase 10 — E2E Test + Deploy

### Task 10.1: Playwright happy-path test

**Files:**
- Create: `playwright.config.ts`, `e2e/happy-path.spec.ts`

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 2: Write `e2e/happy-path.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test('consumer can register and see landing', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('SaveBites');
  await page.click('text=Daftar');
  await expect(page).toHaveURL(/\/register/);
});
```

- [ ] **Step 3: Run**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npx playwright install chromium
npm run dev &
sleep 5
npm run test:e2e
```

Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test(e2e): minimal happy-path smoke"
```

### Task 10.2: Production deploy

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# SaveBites v3

Hemat makanan surplus, selamatkan bumi.

## Stack
- Next.js 15 (App Router, RSC, Server Actions)
- Supabase (Postgres + PostGIS + Auth + Storage + Realtime)
- Midtrans Snap (payments)
- Vercel (hosting + cron)

## Setup lokal
1. `npx supabase start`
2. Isi `.env.local` dari output step 1
3. `npm install && npm run dev`

## Deploy
1. Buat project Supabase production, apply migrations: `npx supabase db push`
2. Buat Vercel project, set env vars
3. `npx vercel --prod`

## Struktur
- `app/(auth)/` — login, register
- `app/(consumer)/` — discovery, listing, orders
- `app/merchant/` — queue, scan, new listing
- `app/admin/` — overview, users, payouts
- `app/api/cron/` — expire orders, T+1 payouts
- `app/api/midtrans/webhook/` — payment callback
- `supabase/migrations/` — schema, RLS, RPCs
- `lib/` — supabase clients, validations, midtrans, payouts, qr

## v3 Out of Scope (deferred to v4)
- Twilio phone OTP (v3: regex-only)
- In-app refund flow (v3: admin via Supabase Studio)
- Auto bank transfer for payouts (v3: manual after T+1 batch)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: v3 production readme"
```

- [ ] **Step 3: Push + deploy**

```bash
cd C:/Users/rinali/Documents/3.TugasMatkul/KBT/SaveBites
npx supabase link --project-ref YOUR_PROD_REF
npx supabase db push
npx vercel --prod
```

Expected: deploy succeeds, URL returned. Verify by visiting homepage and `/login`.

- [ ] **Step 4: Post-deploy verification**

```bash
# Smoke checks
curl -I https://YOUR_DOMAIN/
curl -I https://YOUR_DOMAIN/login
```

Expected: both 200/307.

- [ ] **Step 5: Configure Midtrans webhook in dashboard**

Manual step: set Midtrans production webhook URL to `https://YOUR_DOMAIN/api/midtrans/webhook`.

- [ ] **Step 6: Tag release**

```bash
git tag v3.0.0
git push --tags
```

---

## Spec → Plan Coverage Check

| Spec section | Plan task |
|---|---|
| Tech stack (Next 15, Supabase, Midtrans, Vercel) | Phase 0–10 |
| DB: profiles, merchants, listings, orders, payouts, audit | Task 1.2 |
| PostGIS + nearby RPC | Tasks 1.2, 4.2 |
| RLS policies | Task 1.3 |
| Storage buckets (avatars, logos, food-photos) | Task 1.4 |
| Realtime publication (orders, listings) | Task 1.5 |
| Seed profiles | Task 1.6 |
| Supabase clients (browser, server, admin) | Tasks 2.1–2.3 |
| Middleware (auth + ratelimit) | Task 2.4 |
| Zod schemas | Task 2.5 |
| Email/password auth, no phone OTP | Task 3.1–3.4 |
| Merchant onboarding with GPS | Task 3.5 |
| Consumer discovery (radius, real-time-ish) | Task 4.3 |
| Listing detail + order button | Task 4.4 |
| Order creation, stock atomic decrement | Task 5.1 |
| Midtrans Snap pay page | Task 5.2 |
| Webhook with signature verify | Task 5.3 |
| QR ticket + countdown | Task 6.1 |
| Merchant queue (realtime) | Task 7.1 |
| Merchant new listing | Task 7.2 |
| QR scan + pickup confirmation | Task 7.3 |
| Cron: expire orders | Task 8.1 |
| Cron: T+1 payouts at 09:00 WIB | Task 8.2 |
| Admin overview | Task 9.1 |
| Admin users list | Task 9.2 |
| Admin payouts list | Task 9.2 |
| E2E test | Task 10.1 |
| Production deploy | Task 10.2 |
