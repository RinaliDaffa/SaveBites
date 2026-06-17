import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export interface ReviewRow {
  id: string;
  consumer_id: string;
  merchant_id: string;
  order_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export async function getMerchantReviews(merchantId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('*, profiles:consumer_id(full_name, avatar_url)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });
  return {
    data: (data ?? []) as (ReviewRow & { profiles: { full_name: string; avatar_url: string | null } | null })[],
    error,
  };
}

export async function getMerchantAverageRating(merchantId: string): Promise<number> {
  const { data } = await getMerchantReviews(merchantId);
  if (!data || data.length === 0) return 0;
  const sum = data.reduce((acc, r) => acc + r.rating, 0);
  return sum / data.length;
}
