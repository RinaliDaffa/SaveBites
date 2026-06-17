-- ============================================================================
-- Migration: add geo-discovery columns to profiles
-- ============================================================================
-- Adds last_lat / last_lng to public.profiles so consumers can be matched
-- against nearby merchants via earthdistance (cube + earthdistance
-- extensions, enabled in schema.sql).
--
-- Idempotent: safe to re-run. Columns and index are created only if missing.
-- ============================================================================

alter table public.profiles
  add column if not exists last_lat double precision,
  add column if not exists last_lng double precision;

create index if not exists profiles_last_location_idx
  on public.profiles (last_lat, last_lng)
  where last_lat is not null and last_lng is not null;

-- ---------------------------------------------------------------------------
-- Verification query (run manually in SQL Editor to confirm):
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name   = 'profiles'
--     and column_name in ('last_lat', 'last_lng');
-- Expected rows: 2 (double precision, double precision)
-- ---------------------------------------------------------------------------
