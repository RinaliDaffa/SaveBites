-- ===========================================================
-- SaveBites v3 — Money flow: ledger, settlements, payout job
-- ===========================================================
--
-- Why this migration exists:
-- The create_order RPC sets v_total := v_subtotal and never persists
-- service_fee on the order row. The Midtrans charge route adds +3000 IDR
-- to gross_amount so the consumer pays it, but the money has nowhere to
-- be accounted for in our DB. This migration:
--   1. Adds merchant_ledger as an append-only log of every money event.
--   2. Adds settlements as a per-merchant-per-day payout record.
--   3. Persists service_fee on the order at insert time.
--   4. Records ledger rows when confirm_payment marks an order paid.
--   5. Adds settle_merchant_payouts() that runs from the daily cron.
--
-- Rollback:
--   drop table if exists public.merchant_ledger cascade;
--   drop table if exists public.settlements cascade;
--   -- The service_fee column on public.orders is left in place
--   -- (it was already in init.sql). Drop only if you also rewind
--   -- the create_order RPC to remove the new argument default.
-- ===========================================================

-- ===========================================================
-- merchant_ledger — append-only money log per order
-- ===========================================================
create table public.merchant_ledger (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  kind public.ledger_kind not null,
  amount_idr numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create index idx_merchant_ledger_merchant
  on public.merchant_ledger (merchant_id, created_at desc);
create index idx_merchant_ledger_order
  on public.merchant_ledger (order_id);

-- Append-only: deny UPDATE / DELETE at the row level. Triggers raise
-- on attempted modification.
create or replace function public.deny_modify_ledger()
returns trigger language plpgsql as $$
begin
  raise exception 'merchant_ledger is append-only';
end;
$$;

create trigger trg_ledger_no_update
  before update on public.merchant_ledger
  for each row execute function public.deny_modify_ledger();

create trigger trg_ledger_no_delete
  before delete on public.merchant_ledger
  for each row execute function public.deny_modify_ledger();

-- ===========================================================
-- settlements — daily payout aggregates per merchant
-- ===========================================================
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  period_date date not null,
  gross_idr numeric(10,2) not null default 0,
  fee_idr numeric(10,2) not null default 0,
  net_idr numeric(10,2) not null default 0,
  order_count integer not null default 0,
  status public.settlement_status not null default 'pending',
  transferred_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, period_date)
);

create index idx_settlements_status
  on public.settlements (status, period_date);

-- ===========================================================
-- New enum types
-- ===========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ledger_kind') then
    create type public.ledger_kind as enum (
      'gross',    -- consumer paid this much for the item(s)
      'fee',      -- platform fee attached to the order
      'net',      -- gross - fee (informational; the cron writes a payout row)
      'payout',   -- transfer sent to the merchant
      'refund'    -- refund issued (admin-only)
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'settlement_status') then
    create type public.settlement_status as enum (
      'pending',     -- settlement row written by cron, awaiting transfer
      'transferred', -- funds transferred (or stubbed for sandbox)
      'failed'       -- transfer failed (manual intervention needed)
    );
  end if;
end;
$$;

grant execute on type public.ledger_kind to service_role, authenticated;
grant execute on type public.settlement_status to service_role, authenticated;

-- ===========================================================
-- create_order: persist service_fee on the order row.
-- This replaces the prior create_order definition. The new arg
-- p_service_fee defaults to 3000 (lib/constants.ts.SERVICE_FEE_FLAT_IDR),
-- so existing call sites that don't pass it still get the right value.
-- ===========================================================
create or replace function public.create_order(
  p_listing_id uuid,
  p_quantity int,
  p_service_fee numeric(10,2) default 3000
) returns table (
  order_id uuid,
  order_number text,
  pickup_code text,
  pickup_deadline timestamptz,
  subtotal numeric,
  service_fee numeric,
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
  if p_service_fee < 0 then
    raise exception 'Service fee cannot be negative';
  end if;

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
  v_total := v_subtotal + p_service_fee;
  v_pickup_deadline := v_listing.available_until;
  v_reserved_until := now() + interval '10 minutes';

  insert into public.orders (
    order_number, consumer_id, merchant_id, listing_id, quantity,
    subtotal, discount_total, service_fee, total,
    pickup_code, pickup_deadline, reserved_until
  ) values (
    v_order_number, v_consumer, v_listing.merchant_id, v_listing.id, p_quantity,
    v_subtotal, v_discount, p_service_fee, v_total,
    v_pickup_code, v_pickup_deadline, v_reserved_until
  ) returning id into v_order_id;

  update public.listings
  set quantity_available = quantity_available - p_quantity,
      is_sold_out = (quantity_available - p_quantity) <= 0
  where id = p_listing_id;

  return query
    select v_order_id, v_order_number, v_pickup_code, v_pickup_deadline,
           v_subtotal, p_service_fee, v_total;
end;
$$;

grant execute on function public.create_order(uuid, int, numeric) to authenticated;

-- ===========================================================
-- confirm_payment: also write ledger rows when an order transitions
-- to 'paid'. Idempotent: ledger INSERTs use ON CONFLICT-style guards
-- via a unique partial index so a replayed webhook doesn't double-post.
-- ===========================================================

-- Prevent double-ledger on webhook replays: only one (gross, fee) pair
-- per order. Implemented as a partial unique index on order_id for the
-- two bookkeeping kinds.
create unique index if not exists uq_ledger_gross_per_order
  on public.merchant_ledger (order_id)
  where kind = 'gross';
create unique index if not exists uq_ledger_fee_per_order
  on public.merchant_ledger (order_id)
  where kind = 'fee';

create or replace function public.record_ledger_for_order(p_order_id uuid)
returns void
language plpgsql security definer as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  -- Idempotent: ON CONFLICT DO NOTHING via the partial unique index.
  insert into public.merchant_ledger (merchant_id, order_id, kind, amount_idr)
  values (v_order.merchant_id, v_order.id, 'gross', v_order.subtotal)
  on conflict do nothing;

  insert into public.merchant_ledger (merchant_id, order_id, kind, amount_idr)
  values (v_order.merchant_id, v_order.id, 'fee', v_order.service_fee)
  on conflict do nothing;
end;
$$;

grant execute on function public.record_ledger_for_order(uuid) to service_role;

-- Replace confirm_payment to call record_ledger_for_order on success path.
-- (Body otherwise identical to 00000000000002_payments_and_hardening.sql.)
create or replace function public.confirm_payment(
  p_midtrans_order_id text,
  p_midtrans_txn_id text,
  p_payment_type text,
  p_fraud_status text,
  p_status public.payment_attempt_status,
  p_raw_response jsonb
) returns table (
  order_id uuid,
  order_number text,
  payment_id uuid,
  already_processed boolean
)
language plpgsql security definer as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_already boolean := false;
  v_payment_id uuid;
begin
  select * into v_payment
  from public.payments
  where midtrans_order_id = p_midtrans_order_id
  for update;

  if not found then
    raise exception 'Payment record not found for midtrans_order_id=%', p_midtrans_order_id;
  end if;

  if v_payment.status not in ('pending', 'capture', 'settlement', 'deny', 'cancel', 'expire', 'failure') then
    v_already := true;
    return query
      select v_payment.order_id, o.order_number, v_payment.id, v_already
      from public.orders o where o.id = v_payment.order_id;
    return;
  end if;

  update public.payments
  set status = p_status,
      midtrans_txn_id = coalesce(p_midtrans_txn_id, midtrans_txn_id),
      midtrans_payment_type = coalesce(p_payment_type, midtrans_payment_type),
      midtrans_fraud_status = p_fraud_status,
      raw_response = p_raw_response,
      paid_at = case
        when p_status in ('settlement', 'capture') then coalesce(paid_at, now())
        else paid_at
      end
  where id = v_payment.id
  returning id into v_payment_id;

  if p_status in ('settlement', 'capture') then
    select * into v_order
    from public.orders
    where id = v_payment.order_id
    for update;

    if v_order.payment_status = 'unpaid' and v_order.status = 'pending' then
      update public.orders
      set payment_status = 'paid',
          status = 'paid',
          payment_method = case
            when p_payment_type = 'qris' then 'qris'::public.payment_method
            when p_payment_type = 'gopay' then 'gopay'::public.payment_method
            when p_payment_type = 'ovo' then 'ovo'::public.payment_method
            when p_payment_type = 'dana' then 'dana'::public.payment_method
            when p_payment_type = 'shopeepay' then 'shopeepay'::public.payment_method
            else payment_method
          end
      where id = v_order.id;

      -- Record the money flow into the ledger. Idempotent via the
      -- partial unique indexes on (order_id, kind='gross') and
      -- (order_id, kind='fee'); replayed webhooks hit ON CONFLICT.
      perform public.record_ledger_for_order(v_order.id);
    elsif v_order.payment_status = 'paid' then
      v_already := true;
    end if;

    insert into public.payment_webhooks
      (order_id, payment_id, midtrans_order_id, midtrans_txn_id,
       internal_status, raw_payload, processed_at)
    values
      (v_payment.order_id, v_payment_id, p_midtrans_order_id,
       p_midtrans_txn_id, 'paid', p_raw_response, now());

    return query
      select v_payment.order_id, o.order_number, v_payment_id, v_already
      from public.orders o where o.id = v_payment.order_id;
    return;
  end if;

  insert into public.payment_webhooks
    (order_id, payment_id, midtrans_order_id, midtrans_txn_id,
     internal_status, raw_payload, processed_at)
  values
    (v_payment.order_id, v_payment_id, p_midtrans_order_id,
     p_midtrans_txn_id, p_status::text, p_raw_response, now());

  if p_status in ('expire', 'cancel', 'deny', 'failure') then
    update public.orders
    set payment_status = 'failed'
    where id = v_payment.order_id and payment_status = 'unpaid';
  end if;

  return query
    select v_payment.order_id, o.order_number, v_payment_id, v_already
    from public.orders o where o.id = v_payment.order_id;
end;
$$;

grant execute on function public.confirm_payment(
  text, text, text, text, public.payment_attempt_status, jsonb
) to service_role;

-- ===========================================================
-- settle_merchant_payouts: aggregate prior-day completed orders
-- into one settlement row per merchant. Safe to run multiple times:
-- the unique index on (merchant_id, period_date) means re-runs are
-- no-ops if a settlement row already exists.
-- ===========================================================
create or replace function public.settle_merchant_payouts(p_target_date date default (current_date - 1))
returns table (
  merchant_id uuid,
  period_date date,
  gross_idr numeric,
  fee_idr numeric,
  net_idr numeric,
  order_count integer
)
language plpgsql security definer as $$
begin
  return query
  with eligible as (
    select
      o.merchant_id,
      count(*)::int as cnt,
      sum(o.subtotal)::numeric(10,2) as gross,
      sum(o.service_fee)::numeric(10,2) as fee
    from public.orders o
    where o.status in ('paid', 'completed')
      and o.payment_status = 'paid'
      and o.picked_up_at is not null
      and (o.picked_up_at at time zone 'Asia/Jakarta')::date = p_target_date
    group by o.merchant_id
  ),
  upserted as (
    insert into public.settlements (merchant_id, period_date, gross_idr, fee_idr, net_idr, order_count)
    select e.merchant_id, p_target_date, e.gross, e.fee, (e.gross - e.fee), e.cnt
    from eligible e
    on conflict (merchant_id, period_date) do nothing
    returning merchant_id, period_date, gross_idr, fee_idr, net_idr, order_count
  )
  select u.merchant_id, u.period_date, u.gross_idr, u.fee_idr, u.net_idr, u.order_count
  from upserted u;
end;
$$;

grant execute on function public.settle_merchant_payouts(date) to service_role;

-- ===========================================================
-- RLS for the two new tables. Both are admin-only at the row level;
-- the API/cron routes use the service-role client to bypass.
-- ===========================================================
alter table public.merchant_ledger enable row level security;
alter table public.settlements enable row level security;

-- No policies: RLS enabled with no policies means no anon/authenticated
-- reads or writes. Only service_role bypasses (used by cron + admin routes).