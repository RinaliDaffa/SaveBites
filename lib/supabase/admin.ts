/**
 * SaveBites V3 — Service-role (admin) Supabase client
 *
 * Bypasses RLS using the service_role key. Used exclusively for
 * server-side operations that require elevated privileges:
 *   - Processing Midtrans webhooks (calls confirm_payment RPC)
 *   - Scheduled jobs (order expiry sweeper)
 *
 * This file is only ever imported from API routes (Next.js Server Components
 * cannot import it because the service_role key is not available in browsers).
 */
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
