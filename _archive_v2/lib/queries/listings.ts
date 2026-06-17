import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export interface ListingRow {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  original_price: number;
  discount_pct: number;
  portions_left: number;
  portions_total: number;
  pickup_deadline: string;
  status: 'active' | 'sold_out' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export async function getMerchantListings(merchantId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  return { data: (data ?? []) as ListingRow[], error };
}

export async function getActiveListings(merchantId: string) {
  const { data, error } = await getMerchantListings(merchantId);
  return {
    data: data.filter(
      (l) => l.status === 'active' && new Date(l.pickup_deadline) > new Date()
    ),
    error,
  };
}
