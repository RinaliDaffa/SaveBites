-- ===========================================================
-- SaveBites V3 — Migration 0002
-- Adds: payments + payment_webhooks tables, idempotent confirm_payment
--       RPC, consumer + merchant cancel RPCs (with stock restoration,
--       no in-app refund — refunds are admin-only), order-expiry
--       sweeper (restores stock on unpaid 10-min holds), RLS hardening
--       for profiles role-escalation, merchant rating recalculation
--       trigger, payments added to realtime publication.
-- ===========================================================

-- ===========================================================
-- payments
-- One row per Midtrans charge attempt. Order can have
-- multiple payment attempts (retries) but only one succeeds.
-- ===========================================================
create type public.payment_attempt_status as enum (
  'pending', 'settlement', 'capture', 'deny', 'cancel',
  'expire', 'refund', 'partial_refund', 'chargeback', 'failure'
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  consumer_id uuid not null references public.profiles(id) on delete restrict,
  merchant_id uuid not null references public.merchants(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  payment_method text,
  status public.payment_attempt_status not null default 'pending',
  midtrans_order_id text not null,
  midtrans_txn_id text,
  midtrans_payment_type text,
  midtrans_fraud_status text,
  raw_response jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Midtrans order_id must be unique per charge
  constraint payments_midtrans_order_unique unique (midtrans_order_id)
);

create index idx_payments_order on public.payments (order_id, created_at desc);
create index idx_payments_consumer on public.payments (consumer_id, created_at desc);
create index idx_payments_merchant on public.payments (merchant_id, created_at desc);
create index idx_payments_status on public.payments (status) where status = 'pending';
create index idx_payments_txn on public.payments (midtrans_txn_id) where midtrans_txn_id is not null;

create trigger payments_set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ===========================================================
-- payment_webhooks
-- Append-only audit log for every Midtrans webhook delivery.
-- Use this to debug missing/lost webhooks and as the source of
-- truth for idempotency (unique on midtrans_order_id + status).
-- ===========================================================
create table public.payment_webhooks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid,
  payment_id uuid references public.payments(id) on delete set null,
  midtrans_order_id text not null,
  midtrans_txn_id text,
  internal_status text,
  raw_payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  -- Idempotency: same txn_id + transaction_status can't be applied twice
  unique (midtrans_order_id, midtrans_txn_id)
);

create index idx_webhooks_order on public.payment_webhooks (order_id, received_at desc);
create index idx_webhooks_unprocessed on public.payment_webhooks (received_at)
  where processed_at is null;

-- ===========================================================
-- RLS for new tables
-- ===========================================================
alter table public.payments enable row level security;
alter table public.payment_webhooks enable row level security;

-- payments: consumer sees own, merchant sees own store's; inserts/updates via service role only
create policy "payments_select_consumer"
  on public.payments for select using (auth.uid() = consumer_id);
create policy "payments_select_merchant"
  on public.payments for select using (
    exists (select 1 from public.merchants m
            where m.id = merchant_id and m.owner_id = auth.uid())
  );

-- payment_webhooks: NO policies — service role only.
-- Webhooks must be processed server-side via SUPABASE_SERVICE_ROLE_KEY.
-- Frontend should never read raw webhook payloads.

-- ===========================================================
-- Hardening: profiles_update_self should not allow role escalation
-- The previous policy used `using (auth.uid() = id)` which permits
-- updating `role` to anything. Restrict by column.
-- ===========================================================
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Role is immutable after signup. If you need role changes,
    -- they must go through a service-role RPC, not the client.
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- ===========================================================
-- Idempotent payment confirmation RPC
-- Called by webhook handler. Atomically transitions an order to
-- 'paid' if (and only if) it is currently 'pending' and the
-- linked payment row is in a Midtrans success status.
-- Safe to call multiple times with the same webhook.
-- ===========================================================
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
  -- Idempotency: if a payment with this midtrans_order_id already exists
  -- in a terminal status, return early.
  select * into v_payment
  from public.payments
  where midtrans_order_id = p_midtrans_order_id
  for update;

  if not found then
    raise exception 'Payment record not found for midtrans_order_id=%', p_midtrans_order_id;
  end if;

  if v_payment.status not in ('pending', 'capture', 'settlement', 'deny', 'cancel', 'expire', 'failure') then
    -- Already in a terminal success/refund state — idempotent no-op.
    v_already := true;
    return query
      select v_payment.order_id, o.order_number, v_payment.id, v_already
      from public.orders o where o.id = v_payment.order_id;
    return;
  end if;

  -- Update the payment row.
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

  -- If Midtrans says success, advance the order to 'paid' — once.
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
    elsif v_order.payment_status = 'paid' then
      -- Webhook retry after already-confirmed — idempotent.
      v_already := true;
    end if;

    -- Record the webhook delivery
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

  -- Failure / pending terminal status — record but don't advance order.
  insert into public.payment_webhooks
    (order_id, payment_id, midtrans_order_id, midtrans_txn_id,
     internal_status, raw_payload, processed_at)
  values
    (v_payment.order_id, v_payment_id, p_midtrans_order_id,
     p_midtrans_txn_id, p_status::text, p_raw_response, now());

  if p_status in ('expire', 'cancel', 'deny', 'failure') then
    -- Mark the order as failed (still pending payment — expired soon)
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
-- Consumer cancel reservation RPC
-- Restores listing stock atomically.
-- ===========================================================
create or replace function public.cancel_reservation(p_order_id uuid)
returns public.orders
language plpgsql security definer as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.consumer_id <> auth.uid() then
    raise exception 'Not your order';
  end if;
  -- Consumers can cancel UNPAID reservations only. Once paid,
  -- the merchant must fulfill — refunds are admin-only.
  if v_order.status <> 'pending' or v_order.payment_status <> 'unpaid' then
    raise exception 'Order cannot be cancelled by consumer';
  end if;

  -- create_order() decremented quantity_available unconditionally.
  -- Cancellation of an unpaid hold MUST give stock back so others can buy it.
  update public.listings
  set quantity_available = quantity_available + v_order.quantity,
      is_sold_out = false
  where id = v_order.listing_id;

  update public.orders
  set status = 'cancelled'
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.cancel_reservation(uuid) to authenticated;

-- ===========================================================
-- Merchant cancel order RPC
-- Same as consumer but checks merchant ownership.
-- Used when merchant needs to cancel (out of stock, closed, etc.)
-- ===========================================================
create or replace function public.merchant_cancel_order(p_order_id uuid, p_reason text default null)
returns public.orders
language plpgsql security definer as $$
declare
  v_merchant_id uuid;
  v_order public.orders%rowtype;
begin
  select id into v_merchant_id from public.merchants where owner_id = auth.uid();
  if v_merchant_id is null then
    raise exception 'Not a merchant';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and merchant_id = v_merchant_id
  for update;
  if not found then raise exception 'Order not found for your store'; end if;
  if v_order.status not in ('pending', 'paid') then
    raise exception 'Order cannot be cancelled';
  end if;

  -- Stock restoration is unconditional — it is independent of payment.
  -- Unpaid: stock was reserved, give it back.
  -- Paid: stock was sold, reverse the sale.
  -- Admin-only refund for the money; stock math is independent.
  update public.listings
  set quantity_available = quantity_available + v_order.quantity,
      is_sold_out = false
  where id = v_order.listing_id;

  -- payment_status = 'refunded' remains admin-only.
  -- We do NOT touch payment_status here. Merchant cancels fulfillment
  -- (status -> 'cancelled'); admin handles the money side separately.
  update public.orders
  set status = 'cancelled',
      notes = coalesce(p_reason, notes)
  where id = v_order.id
  returning * into v_order;

  return v_order;
end;
$$;

grant execute on function public.merchant_cancel_order(uuid, text) to authenticated;

-- ===========================================================
-- Auto-expire orders past pickup_deadline
-- Sweeper that runs hourly via pg_cron (extension installed
-- separately). For now, just expose the function.
-- ===========================================================
create or replace function public.expire_unpaid_orders() returns integer
language plpgsql security definer as $$
declare
  v_count int;
begin
  -- Expire stale pending+unpaid orders, restore their stock,
  -- then count how many were actually expired so the caller knows
  -- whether to run Midtrans cancel or just show "hold expired".
  with expired_ids as (
    update public.orders
    set status = 'expired'
    where status = 'pending'
      and payment_status = 'unpaid'
      and pickup_deadline < now()
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

-- ===========================================================
-- Merchant rating recalculation trigger
-- Whenever a review changes, recompute the merchant aggregate.
-- More reliable than relying on app code to remember.
-- ===========================================================
create or replace function public.recalculate_merchant_rating() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    update public.merchants
    set rating = coalesce((select avg(rating)::numeric(3,2) from public.reviews where merchant_id = OLD.merchant_id), 0),
        total_reviews = (select count(*) from public.reviews where merchant_id = OLD.merchant_id)
    where id = OLD.merchant_id;
    return OLD;
  else
    update public.merchants
    set rating = (select avg(rating)::numeric(3,2) from public.reviews where merchant_id = NEW.merchant_id),
        total_reviews = (select count(*) from public.reviews where merchant_id = NEW.merchant_id)
    where id = NEW.merchant_id;
    return NEW;
  end if;
end;
$$;

drop trigger if exists reviews_recalc on public.reviews;
create trigger reviews_recalc
  after insert or update or delete on public.reviews
  for each row execute function public.recalculate_merchant_rating();

-- ===========================================================
-- Realtime: payments table for checkout status updates
-- ===========================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;
end $$;