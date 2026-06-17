#!/bin/bash
# ============================================================================
# SaveBites — Supabase Schema Deployment
# ============================================================================
# Applies supabase/migration-add-geo-columns.sql and
# supabase/migration-add-business-fields.sql to the configured Supabase
# project. Uses the Supabase CLI if available; otherwise prints the manual
# steps for the Supabase Dashboard → SQL Editor.
#
# Required environment:
#   NEXT_PUBLIC_SUPABASE_URL  — project URL (e.g. https://xxx.supabase.co)
#   NEXT_PUBLIC_SUPABASE_ANON_KEY — anon key (read-only-safe to ship)
#   SUPABASE_SERVICE_ROLE_KEY  — service role key (server-only, never expose)
#
# Optional: link the repo to a Supabase project with `supabase link --project-ref <ref>`
# so `supabase db push` can run non-interactively.
# ============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG_DIR="${PROJECT_ROOT}/supabase"
MIG_GEO="${MIG_DIR}/migration-add-geo-columns.sql"
MIG_BIZ="${MIG_DIR}/migration-add-business-fields.sql"

echo "=== SaveBites Supabase Setup ==="
echo ""
echo "Project root: ${PROJECT_ROOT}"
echo "Target URL:   ${NEXT_PUBLIC_SUPABASE_URL:-<not set>}"
echo ""

# --- preflight ---------------------------------------------------------------
if [[ -f "${PROJECT_ROOT}/.env.local" ]]; then
  echo "Loading .env.local ..."
  set -a
  # shellcheck disable=SC1091
  source "${PROJECT_ROOT}/.env.local"
  set +a
fi

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
  echo "ERROR: NEXT_PUBLIC_SUPABASE_URL is not set."
  echo "Add it to .env.local or export it in your shell."
  exit 1
fi

if [[ ! -f "${MIG_GEO}" || ! -f "${MIG_BIZ}" ]]; then
  echo "ERROR: migration files missing in ${MIG_DIR}"
  exit 1
fi

# --- apply -------------------------------------------------------------------
if command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI found: $(supabase --version)"
  echo "Running: supabase db push"
  supabase db push
  echo ""
  echo "Migrations applied via Supabase CLI."
else
  echo "Supabase CLI not found on PATH."
  echo ""
  echo "Apply the migrations manually:"
  echo "  1. Open https://app.supabase.com/project/dbizcmezzdsusqymagln/editor"
  echo "  2. Go to SQL Editor"
  echo "  3. Paste and run: ${MIG_GEO}"
  echo "  4. Paste and run: ${MIG_BIZ}"
  echo ""
  echo "Both files use IF NOT EXISTS, so re-running is safe."
fi

# --- post-check --------------------------------------------------------------
echo ""
echo "=== Post-deploy checks ==="
echo "1. Confirm columns on profiles:"
echo "     select column_name from information_schema.columns"
echo "     where table_schema = 'public' and table_name = 'profiles'"
echo "     and column_name in ('last_lat','last_lng','business_name','address','lat','lng');"
echo ""
echo "2. Confirm nearby_listings RPC exists:"
echo "     select proname from pg_proc where proname = 'nearby_listings';"
echo ""
echo "3. If the RPC is missing, run the definition from schema.sql"
echo "   (search for 'create or replace function public.nearby_listings')."
echo ""
echo "Done. Visit: https://app.supabase.com/project/dbizcmezzdsusqymagln/editor"
