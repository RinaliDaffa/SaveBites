import { createSupabaseServerClient } from "./supabase-server";

export interface NearbyListing {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  original_price: number;
  discount_pct: number;
  portions_total: number;
  portions_left: number;
  pickup_deadline: string;
  business_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
}

export async function getNearbyListings(
  lat: number,
  lng: number,
  radiusMeters = 2000
) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("nearby_listings", {
    user_lat: lat,
    user_lng: lng,
    radius_m: radiusMeters,
  });
  return { data: (data ?? []) as NearbyListing[], error };
}

export interface ListingWithMerchant {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  original_price: number;
  discount_pct: number;
  portions_total: number;
  portions_left: number;
  pickup_deadline: string;
  status: string;
  created_at: string;
  updated_at: string;
  profiles: {
    business_name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
}

export async function getListingById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "*, profiles:merchant_id(business_name, address, lat, lng)"
    )
    .eq("id", id)
    .single();
  return { data: data as ListingWithMerchant | null, error };
}

export interface OrderWithListing {
  id: string;
  consumer_id: string;
  listing_id: string;
  merchant_id: string;
  portions: number;
  total_price: number;
  qr_token: string;
  status:
    | "awaiting_payment"
    | "paid"
    | "picked_up"
    | "expired"
    | "cancelled";
  payment_ref: string | null;
  pickup_deadline: string;
  paid_at: string | null;
  picked_up_at: string | null;
  created_at: string;
  updated_at: string;
  listings: ListingWithMerchant | null;
  profiles: {
    business_name: string | null;
    address: string | null;
  } | null;
}

export async function getOrderById(id: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "*, listings(*, profiles:merchant_id(business_name, address)), profiles:merchant_id(business_name, address)"
    )
    .eq("id", id)
    .single();
  return { data: data as OrderWithListing | null, error };
}

export async function getConsumerProfile() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: null };
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, last_lat, last_lng")
    .eq("id", user.id)
    .single();
  return {
    data: data as
      | {
          id: string;
          role: string;
          full_name: string;
          last_lat: number | null;
          last_lng: number | null;
        }
      | null,
    error,
  };
}
