import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMerchantListings } from '@/lib/queries/merchant';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;

    const filters: { is_active?: boolean; is_sold_out?: boolean } = {};
    if (status === 'active') filters.is_active = true;
    if (status === 'paused') filters.is_active = false;
    if (status === 'sold_out') filters.is_sold_out = true;

    const listings = await getMerchantListings(user.id, filters);
    return NextResponse.json(listings);
  } catch (error) {
    console.error('[MERCHANT LISTINGS] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}