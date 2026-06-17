import { createSupabaseServerClient } from '@/lib/supabase-server';
import { cookies } from 'next/headers';

export interface MerchantProfile {
  id: string;
  full_name: string;
  business_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  role: 'consumer' | 'merchant';
  created_at: string;
  updated_at: string;
}

export async function getMerchantProfile(merchantId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', merchantId)
    .single();
  return { data: data as MerchantProfile | null, error };
}
