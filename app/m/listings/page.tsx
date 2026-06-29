/**
 * SaveBites V3 — Merchant Listings Index Page
 * Server Component that resolves the owner from auth session and delegates to client.
 */

import { getMerchantListings } from '@/lib/queries/merchant';
import MerchantListingsClient from './MerchantListingsClient';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Listing } from '@/lib/types/database';

export default async function MerchantListingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login?next=/m/listings');
  }

  // Resolve merchant UUID from auth user and fetch listings.
  const listings = (await getMerchantListings(user.id)) as Listing[];

  return <MerchantListingsClient listings={listings} />;
}
