-- ===========================================================
-- SaveBites v3 — error_logs table + structured logger support
-- ===========================================================
--
-- Why: routes currently log to console.error only. In production
-- (Vercel) the console stream is ephemeral -- log lines older than a
-- few hours are gone, and there's no way to grep them by request_id,
-- user_id, or route. This migration adds a queryable error log that
-- the structured logger (lib/logger.ts) writes to on every error
-- path. Rows older than 30 days can be pruned by a separate cleanup
-- job (not added here -- the friendly-cohort deployment does not
-- generate enough traffic to need it).
--
-- Rollback:
--   drop table if exists public.error_logs cascade;
--   drop type if exists public.error_level;
-- ===========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'error_level') then
    create type public.error_level as enum ('debug', 'info', 'warn', 'error', 'fatal');
  end if;
end;
$$;

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  level public.error_level not null default 'error',
  route text not null,
  method text,
  request_id text,
  user_id uuid,
  status_code integer,
  message text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index idx_error_logs_route
  on public.error_logs (route, created_at desc);
create index idx_error_logs_level
  on public.error_logs (level, created_at desc);
create index idx_error_logs_user
  on public.error_logs (user_id, created_at desc)
  where user_id is not null;

alter table public.error_logs enable row level security;

-- No policies = no anon/authenticated reads or writes. Only service_role
-- bypasses (used by the logger and the admin support tooling).