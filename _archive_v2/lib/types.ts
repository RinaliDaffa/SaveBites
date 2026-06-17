/** Core shared types for SaveBites — single source of truth. */

export interface Consumer {
  id: string;
  full_name: string;
  phone: string;
  email: string;
}

export interface Merchant {
  id: string;
  slug: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  cover_image_url: string | null;
}

export interface MenuItem {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  original_price: number;
  discount_percent: number;
  current_price: number;
  remaining_portions: number;
  available_until: string;
}

export interface ListingWithMerchant extends MenuItem {
  merchant: Merchant;
  distanceKm: number;
}
