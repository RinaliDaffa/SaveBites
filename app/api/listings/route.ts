import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createListing } from '@/lib/queries/listings';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, originalPrice, surplusPrice, quantity, availableUntil, category, dietaryTags } = body;

    if (!title || !originalPrice || !surplusPrice || !quantity || !availableUntil) {
      return NextResponse.json(
        { error: 'Missing required fields: title, originalPrice, surplusPrice, quantity, availableUntil' },
        { status: 400 }
      );
    }

    const listing = await createListing(user.id, {
      title,
      description,
      originalPrice: Number(originalPrice),
      surplusPrice: Number(surplusPrice),
      quantity: Number(quantity),
      availableUntil,
      category,
      dietaryTags,
    });

    if (!listing) {
      return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 });
    }

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    console.error('[LISTING CREATE] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}