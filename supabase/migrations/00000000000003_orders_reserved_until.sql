-- ===========================================================
-- SaveBites V3 — Migration 0003
-- Adds: orders.reserved_until (10-minute payment hold window)
-- Updates: create_order() to set reserved_until = now() + 10 min
-- Updates: expire_unpaid_orders() to expire based on reserved_until
-- ===========================================================

-- ===========================================================
-- reserved_until: per-order payment hold deadline.
-- Independent of pickup_deadline (which is the listing's
-- available_until window — usually 2 hours). The 10-min hold
-- is the time the consumer has to complete payment before
-- the order expires and stock is restored.
-- ===========================================================
alter table public.orders
  add column if not exists reserved_until timestamptz;

-- Backfill: any existing orders that don't have a reserved_until get one
-- derived from their pickup_deadline. New orders always have it set by
-- create_order(). Orders older than the migration date are no-ops.
update public.orders
  set reserved_until = pickup_deadline
  where reserved_until is null;

-- Index for the sweeper. Partial index — only pending+unpaid orders
-- are candidates for expiration.
create index if not exists idx_orders_reserved_until
  on public.orders (reserved_until)
  where status = 'pending' and payment_status = 'unpaid';

-- ===========================================================
-- create_order: now sets reserved_until = now() + 10 minutes.
-- This is the explicit per-spec §7.1 reservation window.
-- ===========================================================
create or replace function public.create_order(
  p_listing_id uuid,
  p_quantity int
) returns table (
  order_id uuid,
  order_number text,
  pickup_code text,
  pickup_deadline timestamptz,
  reserved_until timestamptz,
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
  v_reserved_until timestamptz;
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
  -- Spec §7.1: 10-minute payment hold from the moment of reservation.
  v_reserved_until := now() + interval '10 minutes';

  insert into public.orders (
    order_number, consumer_id, merchant_id, listing_id, quantity,
    subtotal, discount_total, total, pickup_code,
    pickup_deadline, reserved_until
  ) values (
    v_order_number, v_consumer, v_listing.merchant_id, v_listing.id, p_quantity,
    v_subtotal, v_discount, v_total, v_pickup_code,
    v_pickup_deadline, v_reserved_until
  ) returning id into v_order_id;

  update public.listings
  set quantity_available = quantity_available - p_quantity,
      is_sold_out = (quantity_available - p_quantity) <= 0
  where id = p_listing_id;

  return query
    select v_order_id, v_order_number, v_pickup_code,
           v_pickup_deadline, v_reserved_until, v_total;
end;
$$;

-- ===========================================================
-- expire_unpaid_orders: use reserved_until (10-min hold) instead of
-- pickup_deadline. The 10-minute payment window is the contract.
-- Fall back to pickup_deadline for any legacy rows where
-- reserved_until was backfilled to the listing window — that
-- just means they expire at the same time as before, no worse.
-- ===========================================================
create or replace function public.expire_unpaid_orders() returns integer
language plpgsql security definer as $$
declare
  v_count int;
begin
  with expired_ids as (
    update public.orders
    set status = 'expired'
    where status = 'pending'
      and payment_status = 'unpaid'
      and coalesce(reserved_until, pickup_deadline) < now()
    returning id, listing_id, quantity
  ), restored as (
    update public.listings
    set quantity_available = quantity_available + e.quantity,
        is_sold_out = false
    from expired_ids e
    where listings.id = e.listing_id
  )
  select count(*) into v_count from expired_ids;
  return v_count;
end;
$$;

grant execute on function public.expire_unpaid_orders() to service_role;