/**
 * SaveBites V3 — Cron: Expire unpaid orders
 *
 * Runs once per minute via Vercel Cron. Calls the SQL sweeper
 * `public.expire_unpaid_orders()` which expires pending+unpaid orders
 * whose reserved_until (or pickup_deadline for legacy orders) has passed,
 * restores listing stock, and returns the count expired.
 *
 * Auth: Vercel sends the X-Cron-Secret header on every scheduled invocation.
 */

import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  // Verify Vercel Cron secret
  const secret = request.headers.get('X-Cron-Secret');
  if (secret !== process.env.VERCEL_CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env vars for cron handler');
    return Response.json(
      { error: 'Server misconfigured' },
      { status: 500 },
    );
  }

  // Service-role client bypasses RLS; safe for cron because the X-Cron-Secret
  // header has already been verified above.
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('expire_unpaid_orders');

  if (error) {
    console.error('expire_unpaid_orders RPC failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ expired: data ?? 0 });
}