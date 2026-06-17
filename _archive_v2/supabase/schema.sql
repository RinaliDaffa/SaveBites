-- ============================================================================
-- SaveBites — Supabase Schema
-- ============================================================================
-- All tables live in the `public` schema. Row-Level Security is enabled on
-- every table; policies use auth.uid() so consumers see only their own orders
-- and merchants see only their own listings.
--
-- Geospatial: Supabase Postgres includes the `cube` and `earthdistance`
-- extensions by default, so we use ll_to_earth() for radius queries.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ────────────────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "cube";
create extension if not exists "earthdistance";

-- ────────────────────────────────────────────────────────────────────────────
-- profiles — extends auth.users with role + display info
-- ────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid        primary key references auth.users (id) on delete cascade,
  role          text        not null check (role in ('consumer', 'merchant')),
  full_name     text        not null,
  -- Consumer-only fields (null for merchants)
  last_lat      double precision,
  last_lng      double precision,
  -- Merchant-only fields (null for consumers)
  business_name text,
  address       text,
  lat           double precision,
  lng           double precision,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- At least one of consumer/merchant identifying fields must be present
  check (
    (role = 'consumer' and business_name is null and address is null)
    or
    (role = 'merchant' and business_name is not null and address is not null and lat is not null and lng is not null)
  )
);

create index profiles_role_idx on public.profiles (role);

-- ────────────────────────────────────────────────────────────────────────────
-- listings — surplus food posted by merchants
-- ────────────────────────────────────────────────────────────────────────────
-- Discount % is stored directly (not as a multiplier) so merchants can pick
-- the same slider values mentioned in the product concept: 50, 60, 70.
create table public.listings (
  id              uuid        primary key default uuid_generate_v4(),
  merchant_id     uuid        not null references public.profiles (id) on delete cascade,
  title           text        not null,
  description     text,
  image_url       text,
  original_price  integer     not null check (original_price > 0), -- IDR, whole rupiah
  discount_pct    integer     not null check (discount_pct between 0 and 90),
  portions_total  integer     not null check (portions_total > 0),
  portions_left   integer     not null check (portions_left >= 0),
  pickup_deadline timestamptz not null,
  status          text        not null default 'active'
                  check (status in ('active', 'sold_out', 'expired', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Invariant: portions_left can never exceed portions_total
  check (portions_left <= portions_total)
);

create index listings_merchant_idx      on public.listings (merchant_id);
create index listings_status_deadline_idx on public.listings (status, pickup_deadline);
-- Radius search: merchant's location at the time of search
create index listings_merchant_geo_idx  on public.listings (merchant_id);

-- ────────────────────────────────────────────────────────────────────────────
-- orders — consumer claims on listings
-- ────────────────────────────────────────────────────────────────────────────
create table public.orders (
  id                  uuid        primary key default uuid_generate_v4(),
  consumer_id         uuid        not null references public.profiles (id) on delete cascade,
  listing_id          uuid        not null references public.listings (id) on delete restrict,
  merchant_id         uuid        not null references public.profiles (id) on delete restrict,
  portions            integer     not null default 1 check (portions > 0),
  total_price         integer     not null check (total_price >= 0), -- IDR
  qr_token            text        not null unique default replace(gen_random_uuid()::text, '-', ''),
  status              text        not null default 'awaiting_payment'
                      check (status in (
                        'awaiting_payment',
                        'paid',
                        'picked_up',
                        'expired',
                        'cancelled'
                      )),
  payment_ref         text,                              -- Midtrans transaction id
  pickup_deadline     timestamptz not null,
  paid_at             timestamptz,
  picked_up_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index orders_consumer_idx on public.orders (consumer_id);
create index orders_merchant_idx on public.orders (merchant_id);
create index orders_listing_idx  on public.orders (listing_id);
create index orders_status_idx   on public.orders (status);

-- ────────────────────────────────────────────────────────────────────────────
-- reviews — post-pickup ratings
-- ────────────────────────────────────────────────────────────────────────────
create table public.reviews (
  id          uuid        primary key default uuid_generate_v4(),
  order_id    uuid        not null unique references public.orders (id) on delete cascade,
  consumer_id uuid        not null references public.profiles (id) on delete cascade,
  merchant_id uuid        not null references public.profiles (id) on delete cascade,
  rating      integer     not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

create index reviews_merchant_idx on public.reviews (merchant_id);

-- ────────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger listings_touch before update on public.listings
  for each row execute function public.touch_updated_at();
create trigger orders_touch   before update on public.orders
  for each row execute function public.touch_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.listings  enable row level security;
alter table public.orders    enable row level security;
alter table public.reviews   enable row level security;

-- profiles: anyone authenticated can read (needed for displaying merchant info
-- next to a listing); only the owner can update their own row.
create policy "profiles read"   on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles update" on public.profiles
  for update using (auth.uid() = id);

-- listings: anyone authenticated can read active listings; merchants manage
-- their own rows.
create policy "listings read"        on public.listings
  for select using (
    status = 'active'
    or auth.uid() = merchant_id
  );
create policy "listings insert own"  on public.listings
  for insert with check (auth.uid() = merchant_id);
create policy "listings update own"  on public.listings
  for update using (auth.uid() = merchant_id);
create policy "listings delete own"  on public.listings
  for delete using (auth.uid() = merchant_id);

-- orders: consumers see their own orders; merchants see orders for their
-- listings. Both parties need to read for the pickup queue and ticket view.
create policy "orders read own"      on public.orders
  for select using (
    auth.uid() = consumer_id
    or auth.uid() = merchant_id
  );
create policy "orders insert as consumer" on public.orders
  for insert with check (auth.uid() = consumer_id);
create policy "orders update own"    on public.orders
  for update using (
    auth.uid() = consumer_id
    or auth.uid() = merchant_id
  );

-- reviews: anyone authenticated can read; only the consumer who owns the
-- order can insert (must also have a corresponding picked_up order — enforced
-- in the server action, not the DB).
create policy "reviews read"         on public.reviews
  for select using (auth.role() = 'authenticated');
create policy "reviews insert own"   on public.reviews
  for insert with check (auth.uid() = consumer_id);
create policy "reviews update own"   on public.reviews
  for update using (auth.uid() = consumer_id);

-- ────────────────────────────────────────────────────────────────────────────
-- Helper: nearby listings via earthdistance
-- ────────────────────────────────────────────────────────────────────────────
-- Usage: select * from public.nearby_listings(-6.2, 106.8, 2000);
-- Returns all active listings whose merchant is within `radius_m` meters,
-- with distance_m computed.
create or replace function public.nearby_listings(
  user_lat   double precision,
  user_lng   double precision,
  radius_m   integer       -- meters
)
returns table (
  id              uuid,
  merchant_id     uuid,
  title           text,
  description     text,
  image_url       text,
  original_price  integer,
  discount_pct    integer,
  portions_total  integer,
  portions_left   integer,
  pickup_deadline timestamptz,
  business_name   text,
  address         text,
  lat             double precision,
  lng             double precision,
  distance_m      double precision
)
language sql stable security invoker as $$
  select
    l.id,
    l.merchant_id,
    l.title,
    l.description,
    l.image_url,
    l.original_price,
    l.discount_pct,
    l.portions_total,
    l.portions_left,
    l.pickup_deadline,
    p.business_name,
    p.address,
    p.lat,
    p.lng,
    earth_distance(ll_to_earth(p.lat, p.lng), ll_to_earth(user_lat, user_lng)) as distance_m
  from public.listings l
  join public.profiles p on p.id = l.merchant_id
  where l.status = 'active'
    and l.pickup_deadline > now()
    and l.portions_left > 0
    and earth_box(ll_to_earth(user_lat, user_lng), radius_m) @> ll_to_earth(p.lat, p.lng)
    and earth_distance(ll_to_earth(p.lat, p.lng), ll_to_earth(user_lat, user_lng)) <= radius_m
  order by distance_m asc;
$$;

grant execute on function public.nearby_listings(double precision, double precision, integer) to authenticated;
