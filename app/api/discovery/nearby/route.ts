import { NextRequest, NextResponse } from 'next/server';
import { getNearbyListings } from '@/lib/queries/listings';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, radius = 5000, maxPrice, limit = 20, sortBy = 'expiring' } = body;

    if (lat == null || lng == null) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
    }

    const listings = await getNearbyListings(lat, lng, radius, maxPrice, limit);

    // Apply client-side sort
    if (sortBy === 'cheapest') {
      listings.sort((a, b) => a.surplus_price - b.surplus_price);
    } else if (sortBy === 'nearest') {
      listings.sort((a, b) => a.distance_km - b.distance_km);
    } else {
      // expiring (default): already sorted by available_until ASC from query
    }

    return NextResponse.json(listings);
  } catch (error) {
    console.error('[DISCOVERY] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** GET — discover nearby listings by query params */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radius = parseFloat(searchParams.get('radius') ?? '5000');
  const maxPrice = searchParams.has('maxPrice') ? parseFloat(searchParams.get('maxPrice') ?? '0') : undefined;
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const sortBy = searchParams.get('sortBy') ?? 'expiring';

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const listings = await getNearbyListings(lat, lng, radius, maxPrice, limit);

  if (sortBy === 'cheapest') {
    listings.sort((a, b) => a.surplus_price - b.surplus_price);
  } else if (sortBy === 'nearest') {
    listings.sort((a, b) => a.distance_km - b.distance_km);
  }

  return NextResponse.json(listings);
}
