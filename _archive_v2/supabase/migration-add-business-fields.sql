-- ============================================================================
-- Migration: add merchant business fields to profiles
-- ============================================================================
-- Adds business_name, address, lat, lng to public.profiles. These are
-- populated for rows where role = 'merchant' and consumed by the consumer
-- pages (listing cards, merchant detail, map view).
--
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.profiles
  add column if not exists business_name text,
  add column if not exists address       text,
  add column if not exists lat           double precision,
  add column if not exists lng           double precision;

-- Optional supporting indexes (one-time; only created if missing).
create index if not exists profiles_business_name_idx
  on public.profiles (business_name)
  where business_name is not null;

create index if not exists profiles_merchant_geo_idx
  on public.profiles (lat, lng)
  where lat is not null and lng is not null and role = 'merchant';

-- ---------------------------------------------------------------------------
-- Verification query (run manually in SQL Editor to confirm):
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name   = 'profiles'
--     and column_name in ('business_name', 'address', 'lat', 'lng');
-- Expected rows: 4 (text, text, double precision, double precision)
-- ---------------------------------------------------------------------------
