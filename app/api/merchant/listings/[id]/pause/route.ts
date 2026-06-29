import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { pauseListing } from '@/lib/queries/merchant';
import { getListingById } from '@/lib/queries/listings';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const success = await pauseListing(id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to pause listing' }, { status: 500 });
    }

    const listing = await getListingById(id);
    return NextResponse.json(listing);
  } catch (error) {
    console.error('[MERCHANT LISTING PAUSE] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}