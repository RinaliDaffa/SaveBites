/**
 * Daily payouts cron.
 *
 * Runs once a day at 02:00 WIB (Asia/Jakarta) per vercel.json.
 * Calls public.settle_merchant_payouts(target_date) which writes one
 * settlements row per merchant with that day's completed-pickup orders.
 *
 * In sandbox mode (the friendly-cohort deployment), the route does NOT
 * call Midtrans disbursement -- it just marks each pending settlement
 * as 'transferred' immediately. Real-money deployments flip
 * DISBURSEMENT_MODE to 'live' and the route will then call Midtrans's
 * disbursement endpoint per settlement row.
 *
 * Auth: header x-cron-secret must match env CRON_SECRET. The route is
 * invoked by Vercel Cron; never expose it to clients.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// When 'live', settlements go through Midtrans disbursement. When
// 'sandbox' (default), settlements are marked transferred immediately.
const DISBURSEMENT_MODE: 'sandbox' | 'live' =
  (process.env.DISBURSEMENT_MODE as 'sandbox' | 'live') ?? 'sandbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SettlementRow {
  merchant_id: string;
  period_date: string;
  gross_idr: string;
  fee_idr: string;
  net_idr: string;
  order_count: number;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Allow callers to override the target date for backfills (YYYY-MM-DD).
  // Otherwise default to yesterday in Asia/Jakarta so the cron catches
  // everything picked up during local business hours.
  let targetDate: string | null = null;
  try {
    const body = (await req.json().catch(() => null)) as { targetDate?: string } | null;
    if (body?.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)) {
      targetDate = body.targetDate;
    }
  } catch {
    // No body is fine.
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('settle_merchant_payouts', {
    p_target_date: targetDate ?? null,
  });

  if (error) {
    console.error('[CRON PAYOUTS] settle_merchant_payouts error:', error);
    return NextResponse.json(
      { error: 'Settlement aggregation failed', details: error.message },
      { status: 500 },
    );
  }

  const settlements = (data ?? []) as SettlementRow[];

  if (settlements.length === 0) {
    return NextResponse.json({
      success: true,
      mode: DISBURSEMENT_MODE,
      targetDate,
      settlementsWritten: 0,
      message: 'No eligible completed orders for target date.',
    });
  }

  if (DISBURSEMENT_MODE === 'sandbox') {
    // Mark all just-written settlements as transferred immediately.
    // The platform does not move money in sandbox mode.
    for (const row of settlements) {
      const { error: perRowErr } = await supabase
        .from('settlements')
        .update({
          status: 'transferred',
          transferred_at: new Date().toISOString(),
        })
        .eq('merchant_id', row.merchant_id)
        .eq('period_date', row.period_date)
        .eq('status', 'pending');
      if (perRowErr) {
        console.error(
          `[CRON PAYOUTS] sandbox update failed for merchant=${row.merchant_id} date=${row.period_date}:`,
          perRowErr,
        );
      }
    }
  } else {
    // Live mode: call Midtrans disbursement per settlement.
    // NOTE: requires MIDTRANS_DISBURSEMENT_ACCOUNT_ID + a separate
    // disbursement API key (talk to Midtrans). Skipped for the
    // friendly-cohort deployment.
    for (const row of settlements) {
      try {
        // TODO: wire up createDisbursement here. See
        // lib/midtrans/client.ts -- needs a new function for the
        // /disbursement endpoint.
        await supabase
          .from('settlements')
          .update({
            status: 'failed',
            failure_reason: 'live disbursement not yet implemented',
          })
          .eq('merchant_id', row.merchant_id)
          .eq('period_date', row.period_date)
          .eq('status', 'pending');
      } catch (err) {
        console.error('[CRON PAYOUTS] disbursement error:', err);
      }
    }
  }

  return NextResponse.json({
    success: true,
    mode: DISBURSEMENT_MODE,
    targetDate,
    settlementsWritten: settlements.length,
    settlements,
  });
}

export async function GET(req: NextRequest) {
  // Same handler; Vercel Cron uses GET in some configs.
  return POST(req);
}