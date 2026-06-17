import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export interface OrderRow {
  id: string;
  consumer_id: string;
  merchant_id: string;
  listing_id: string;
  portions: number;
  total_price: number;
  status: 'awaiting_payment' | 'paid' | 'picked_up' | 'cancelled' | 'expired';
  qr_token: string;
  pickup_deadline: string;
  created_at: string;
  updated_at: string;
}

export async function getMerchantPickupQueue(merchantId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, listings(title, image_url, original_price, discount_pct)'
    )
    .eq('merchant_id', merchantId)
    .eq('status', 'paid')
    .gt('pickup_deadline', new Date().toISOString())
    .order('created_at', { ascending: true });
  return {
    data: (data ?? []) as (OrderRow & { listings: Record<string, unknown> })[],
    error,
  };
}

export async function getMerchantOrderHistory(merchantId: string, limit = 20) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, listings(title)')
    .eq('merchant_id', merchantId)
    .in('status', ['picked_up', 'cancelled', 'expired'])
    .order('created_at', { ascending: false })
    .limit(limit);
  return {
    data: (data ?? []) as (OrderRow & { listings: Record<string, unknown> })[],
    error,
  };
}
