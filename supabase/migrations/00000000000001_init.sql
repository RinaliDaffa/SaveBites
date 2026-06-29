-- ===========================================================
-- SaveBites V3 — Production-Grade Schema
-- Core primitives: profiles, merchants, listings, orders
-- Strict: no menu_items / order_items / cart / catalog
-- ===========================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create type public.user_role as enum ('consumer', 'merchant');
create type public.order_status as enum (
  'pending', 'paid', 'ready', 'completed', 'cancelled', 'expired'
);
create type public.payment_status as enum ('unpaid', 'paid', 'refunded', 'failed');
create type public.payment_method as enum ('qris', 'gopay', 'ovo', 'dana', 'shopeepay', 'cash');

-- ========================================
-- profiles
-- ========================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  avatar_url text,
  role public.user_role not null default 'consumer',
  dietary_tags text[] not null default '{}',
  last_lat double precision,
  last_lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========================================
-- merchants
-- ========================================
create table public.merchants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  slug text not null unique,
  name text not null,
  description text,
  category text not null default 'restaurant',
  cuisine text,
  address text not null,
  city text not null default 'Yogyakarta',
  latitude double precision not null,
  longitude double precision not null,
  phone text,
  logo_url text,
  cover_image_url text,
  rating double precision not null default 0 check (rating >= 0 and rating <= 5),
  total_reviews integer not null default 0,
  is_active boolean not null default true,
  verified boolean not null default false,
  opening_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========================================
-- listings (single source of truth for surplus)
-- ========================================
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  category text not null default 'main',
  original_price numeric(10,2) not null check (original_price > 0),
  surplus_price numeric(10,2) not null check (surplus_price > 0),
  quantity_available integer not null default 0 check (quantity_available >= 0),
  available_from timestamptz not null default now(),
  available_until timestamptz not null,
  dietary_tags text[] not null default '{}',
  is_active boolean not null default true,
  is_sold_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint surplus_lt_original check (surplus_price < original_price),
  constraint valid_window check (available_until > available_from)
);

-- ========================================
-- orders
-- ========================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  consumer_id uuid not null references public.profiles(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  listing_id uuid not null references public.listings(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  payment_method public.payment_method,
  subtotal numeric(10,2) not null,
  discount_total numeric(10,2) not null default 0,
  service_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  pickup_code text not null,
  pickup_deadline timestamptz not null,
  picked_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========================================
-- reviews
-- ========================================
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  consumer_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (merchant_id, consumer_id)
);

-- ========================================
-- Indexes
-- ========================================
create index idx_merchants_geo on public.merchants (latitude, longitude) where is_active;
create index idx_merchants_slug on public.merchants (slug);
create index idx_listings_merchant on public.listings (merchant_id);
create index idx_listings_active on public.listings (is_active, is_sold_out, available_until)
  where is_active = true and is_sold_out = false;
create index idx_listings_dietary on public.listings using gin (dietary_tags);
create index idx_orders_consumer on public.orders (consumer_id, created_at desc);
create index idx_orders_merchant on public.orders (merchant_id, status, created_at desc);
create index idx_orders_pickup_code on public.orders (pickup_code);
create index idx_orders_deadline on public.orders (pickup_deadline) where status in ('paid', 'ready');
create index idx_reviews_merchant on public.reviews (merchant_id);

-- ========================================
-- updated_at trigger
-- ========================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger merchants_set_updated_at before update on public.merchants
  for each row execute function public.set_updated_at();
create trigger listings_set_updated_at before update on public.listings
  for each row execute function public.set_updated_at();
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ========================================
-- Auto-create profile on signup
-- ========================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, phone, role, dietary_tags)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'consumer'),
    coalesce(
      array(select jsonb_array_elements_text(
        coalesce(new.raw_user_meta_data->'dietary_tags', '[]'::jsonb)
      )),
      '{}'
    )
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ========================================
-- ID generators
-- ========================================
create sequence if not exists public.order_number_seq;

create or replace function public.generate_order_number() returns text
language plpgsql as $$
declare seq_val bigint;
begin
  seq_val := nextval('public.order_number_seq');
  return 'SB-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(seq_val::text, 4, '0');
end;
$$;

create or replace function public.generate_pickup_code() returns text
language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

-- ========================================
-- Order creation: atomic listing reservation
-- Validates stock, decrements quantity, sets sold_out, generates order_number + pickup_code
-- ========================================
create or replace function public.create_order(
  p_listing_id uuid,
  p_quantity int
) returns table (
  order_id uuid,
  order_number text,
  pickup_code text,
  pickup_deadline timestamptz,
  total numeric
)
language plpgsql security definer as $$
declare
  v_consumer uuid := auth.uid();
  v_listing public.listings%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_pickup_code text;
  v_subtotal numeric(10,2);
  v_discount numeric(10,2);
  v_total numeric(10,2);
  v_pickup_deadline timestamptz;
begin
  if v_consumer is null then
    raise exception 'Not authenticated';
  end if;
  if p_quantity <= 0 then
    raise exception 'Invalid quantity';
  end if;

  -- Lock the listing row
  select * into v_listing from public.listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found';
  end if;
  if not v_listing.is_active or v_listing.is_sold_out then
    raise exception 'Listing unavailable';
  end if;
  if v_listing.available_until <= now() then
    raise exception 'Listing expired';
  end if;
  if v_listing.quantity_available < p_quantity then
    raise exception 'Insufficient stock';
  end if;

  v_order_number := public.generate_order_number();
  v_pickup_code := public.generate_pickup_code();
  v_subtotal := v_listing.surplus_price * p_quantity;
  v_discount := (v_listing.original_price - v_listing.surplus_price) * p_quantity;
  v_total := v_subtotal;
  v_pickup_deadline := v_listing.available_until;

  insert into public.orders (
    order_number, consumer_id, merchant_id, listing_id, quantity,
    subtotal, discount_total, total, pickup_code, pickup_deadline
  ) values (
    v_order_number, v_consumer, v_listing.merchant_id, v_listing.id, p_quantity,
    v_subtotal, v_discount, v_total, v_pickup_code, v_pickup_deadline
  ) returning id into v_order_id;

  update public.listings
  set quantity_available = quantity_available - p_quantity,
      is_sold_out = (quantity_available - p_quantity) <= 0
  where id = p_listing_id;

  return query select v_order_id, v_order_number, v_pickup_code, v_pickup_deadline, v_total;
end;
$$;

-- ========================================
-- Merchant completion: validates ownership + status, marks picked up
-- ========================================
create or replace function public.mark_order_picked_up(p_pickup_code text)
returns public.orders
language plpgsql security definer as $$
declare
  v_merchant_id uuid;
  v_order public.orders%rowtype;
begin
  select merchants.id into v_merchant_id
  from public.merchants
  where merchants.owner_id = auth.uid();

  if v_merchant_id is null then
    raise exception 'Not a merchant';
  end if;

  select * into v_order
  from public.orders
  where pickup_code = p_pickup_code
  for update;

  if not found then
    raise exception 'Pickup code not found';
  end if;
  if v_order.merchant_id <> v_merchant_id then
    raise exception 'Code belongs to different merchant';
  end if;
  if v_order.status not in ('paid', 'ready') then
    raise exception 'Order not ready for pickup';
  end if;

  update public.orders
  set status = 'completed', picked_up_at = now()
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

-- ========================================
-- Review insert: updates merchant aggregate
-- ========================================
create or replace function public.submit_review(
  p_order_id uuid,
  p_rating int,
  p_comment text default null
) returns public.reviews
language plpgsql security definer as $$
declare
  v_consumer uuid := auth.uid();
  v_order public.orders%rowtype;
  v_review public.reviews%rowtype;
begin
  if v_consumer is null then raise exception 'Not authenticated'; end if;
  if p_rating < 1 or p_rating > 5 then raise exception 'Invalid rating'; end if;

  select * into v_order from public.orders where id = p_order_id and consumer_id = v_consumer;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'completed' then raise exception 'Order not completed'; end if;

  insert into public.reviews (merchant_id, consumer_id, order_id, rating, comment)
  values (v_order.merchant_id, v_consumer, p_order_id, p_rating, p_comment)
  on conflict (merchant_id, consumer_id) do update
    set rating = excluded.rating, comment = excluded.comment, created_at = now()
  returning * into v_review;

  update public.merchants m
  set rating = (select avg(rating)::numeric(3,2) from public.reviews where merchant_id = m.id),
      total_reviews = (select count(*) from public.reviews where merchant_id = m.id)
  where m.id = v_order.merchant_id;

  return v_review;
end;
$$;

-- ========================================
-- RLS
-- ========================================
alter table public.profiles enable row level security;
alter table public.merchants enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.reviews enable row level security;

-- profiles: self read/update, public read of role+name for merchant display
create policy "profiles_select_public"
  on public.profiles for select using (true);
create policy "profiles_update_self"
  on public.profiles for update using (auth.uid() = id);

-- merchants: public read, owner write
create policy "merchants_select_public"
  on public.merchants for select using (true);
create policy "merchants_insert_owner"
  on public.merchants for insert with check (auth.uid() = owner_id);
create policy "merchants_update_owner"
  on public.merchants for update using (auth.uid() = owner_id);
create policy "merchants_delete_owner"
  on public.merchants for delete using (auth.uid() = owner_id);

-- listings: public read active, merchant-owner write
create policy "listings_select_public"
  on public.listings for select using (true);
create policy "listings_insert_owner"
  on public.listings for insert with check (
    exists (select 1 from public.merchants m
            where m.id = merchant_id and m.owner_id = auth.uid())
  );
create policy "listings_update_owner"
  on public.listings for update using (
    exists (select 1 from public.merchants m
            where m.id = merchant_id and m.owner_id = auth.uid())
  );
create policy "listings_delete_owner"
  on public.listings for delete using (
    exists (select 1 from public.merchants m
            where m.id = merchant_id and m.owner_id = auth.uid())
  );

-- orders: consumer sees own, merchant sees own store's
create policy "orders_select_consumer"
  on public.orders for select using (auth.uid() = consumer_id);
create policy "orders_select_merchant"
  on public.orders for select using (
    exists (select 1 from public.merchants m
            where m.id = merchant_id and m.owner_id = auth.uid())
  );
-- inserts go through create_order() only; no direct insert policy
-- updates go through mark_order_picked_up() and merchant status flips; no direct update policy

-- reviews: public read, consumer insert/update of own
create policy "reviews_select_public"
  on public.reviews for select using (true);
create policy "reviews_insert_consumer"
  on public.reviews for insert with check (auth.uid() = consumer_id);
create policy "reviews_update_consumer"
  on public.reviews for update using (auth.uid() = consumer_id);

-- ========================================
-- Realtime: enable on the tables the UI subscribes to
-- ========================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'listings'
  ) then
    alter publication supabase_realtime add table public.listings;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ========================================
-- Grants for RPC functions
-- ========================================
grant execute on function public.create_order(uuid, int) to authenticated;
grant execute on function public.mark_order_picked_up(text) to authenticated;
grant execute on function public.submit_review(uuid, int, text) to authenticated;
