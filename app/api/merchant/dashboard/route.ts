import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMerchantDashboardStats } from '@/lib/queries/merchant';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get('days') ?? 7);

    const stats = await getMerchantDashboardStats(user.id, days);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[MERCHANT DASHBOARD] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}