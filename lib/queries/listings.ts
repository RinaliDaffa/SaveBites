/**
 * SaveBites V3 — Listings Server-Side Queries
 * Production-grade Supabase queries with strict typing.
 * Tables use UUIDs, timestamptz, and the schema columns.
 */

import { createClient } from '@/lib/supabase/server';
import { boundingBox } from '@/lib/utils/distance';
import type { Listing, ListingCard, Merchant } from '@/lib/types/database';

/** Row shape from .select('*, merchant:merchants(...)') for nearby listings */
interface ListingWithMerchantRow extends Listing {
  merchant: Pick<Merchant, 'name' | 'category' | 'latitude' | 'longitude'>;
}

export async function getNearbyListings(
  lat: number,
  lng: number,
  radiusMeters = 5000,
  maxPrice?: number,
  limit = 20,
): Promise<ListingCard[]> {
  const supabase = await createClient();
  const box = boundingBox({ lat, lng }, radiusMeters);

  let query = supabase
    .from('listings')
    .select(
      `*, merchant:merchants!merchant_id(name, category, latitude, longitude)`,
      { count: 'exact' },
    )
    .eq('is_active', true)
    .eq('is_sold_out', false)
    .gte('available_until', new Date().toISOString())
    // Bounding-box pre-filter on MERCHANT coordinates (FK join)
    .gte('merchant.latitude', box.minLat)
    .lte('merchant.latitude', box.maxLat)
    .gte('merchant.longitude', box.minLng)
    .lte('merchant.longitude', box.maxLng);

  if (maxPrice) {
    query = query.lte('surplus_price', maxPrice.toString());
  }

  query = query
    .order('available_until', { ascending: true })
    .range(0, limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching nearby listings:', error);
    return [];
  }

  // Calculate real distances post-filter
  const { haversineMeters } = await import('@/lib/utils/distance');

  const rows = (data ?? []) as ListingWithMerchantRow[];
  const results: ListingCard[] = rows.map((item) => {
    const merchantLat = item.merchant?.latitude ?? 0;
    const merchantLng = item.merchant?.longitude ?? 0;
    const distanceM = haversineMeters(
      { lat, lng },
      { lat: merchantLat, lng: merchantLng },
    );
    const distanceKm = Math.round((distanceM / 1000) * 100) / 100;
    return {
      ...item,
      merchant_name: item.merchant?.name ?? 'Unknown',
      merchant_address: '-',
      merchant_category: item.merchant?.category ?? item.category,
      merchant_latitude: merchantLat,
      merchant_longitude: merchantLng,
      distance_km: distanceKm,
    };
  });

  return results.slice(0, count ?? limit);
}

export async function getListingById(id: string): Promise<
  (Listing & { merchant: Merchant }) | null
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('listings')
    .select(
      `*,
       merchant:merchants!merchant_id (id, owner_id, slug, name, description, category, cuisine, address, city, latitude, longitude, phone, logo_url, cover_image_url, rating, total_reviews, is_active, verified, opening_hours, created_at, updated_at)`,
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching listing:', error);
    return null;
  }

  if (!data) return null;

  const row = data as Listing & { merchant: Merchant };
  return row;
}

export async function getMerchantListings(
  merchantOwnerId: string,
  statusFilter?: string,
): Promise<Listing[]> {
  const supabase = await createClient();

  // Resolve merchant UUID from owner_id
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', merchantOwnerId)
    .maybeSingle();

  if (!merchant?.id) return [];

  let query = supabase
    .from('listings')
    .select('*')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false });

  if (statusFilter === 'active') {
    query = query.eq('is_active', true);
  } else if (statusFilter === 'paused') {
    query = query.eq('is_active', false);
  } else if (statusFilter === 'sold_out') {
    query = query.eq('is_sold_out', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching merchant listings:', error);
    return [];
  }

  return data ?? ([] as Listing[]);
}

export async function updateListingStock(
  listingId: string,
  newQuantity: number,
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('listings')
    .update({
      quantity_available: newQuantity,
      is_sold_out: newQuantity <= 0,
    })
    .eq('id', listingId);

  return !error;
}

/**
 * Create a new listing for the merchant owned by the given owner_id.
 * Resolves merchant_id from owner_id, then inserts a row.
 */
export async function createListing(
  ownerId: string,
  input: {
    title: string;
    description?: string;
    category?: string;
    originalPrice: number;
    surplusPrice: number;
    quantity: number;
    availableUntil: string;
    dietaryTags?: string[];
  },
): Promise<Listing | null> {
  const supabase = await createClient();

  // Resolve merchant_id from owner_id
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (!merchant?.id) {
    console.error('createListing: no merchant found for owner', ownerId);
    return null;
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('listings')
    .insert({
      merchant_id: merchant.id,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? 'other',
      original_price: input.originalPrice,
      surplus_price: input.surplusPrice,
      quantity_available: input.quantity,
      available_from: now,
      available_until: input.availableUntil,
      dietary_tags: input.dietaryTags ?? [],
      is_active: true,
      is_sold_out: false,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating listing:', error);
    return null;
  }

  return (data ?? null) as Listing | null;
}
