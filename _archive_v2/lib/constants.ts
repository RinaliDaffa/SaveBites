import { Merchant, MenuItem } from "./types";

export const DISCOVERY_RADIUS_KM = 2;
export const DEFAULT_PICKUP_DEADLINE_MIN = 180;

export const MERCHANTS: Merchant[] = [
  {
    id: "m1",
    slug: "warteg-bahari",
    name: "Warteg Bahari",
    category: "Indonesian",
    address: "Jl. Merdeka No. 12, Jakarta Pusat",
    latitude: -6.1751,
    longitude: 106.865,
    cover_image_url: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&q=80",
  },
  {
    id: "m2",
    slug: "sate-madura-pak-hadi",
    name: "Sate Madura Pak Hadi",
    category: "BBQ",
    address: "Jl. Asia Afrika No. 8, Jakarta Pusat",
    latitude: -6.178,
    longitude: 106.862,
    cover_image_url: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80",
  },
  {
    id: "m3",
    slug: "bakso-pedas-meledug",
    name: "Bakso Pedas Meledug",
    category: "Soup",
    address: "Jl. Sudirman Kav. 22, Jakarta Selatan",
    latitude: -6.223,
    longitude: 106.808,
    cover_image_url: "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=400&q=80",
  },
  {
    id: "m4",
    slug: "roti-bakar-edy",
    name: "Roti Bakar Edy",
    category: "Dessert",
    address: "Jl. Blok M, Jakarta Selatan",
    latitude: -6.244,
    longitude: 106.801,
    cover_image_url: "https://images.unsplash.com/photo-1584313271780-0a2569209ea9?w=400&q=80",
  }
];

function inHours(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

export const LISTINGS: MenuItem[] = [
  {
    id: "l1",
    merchant_id: "m1",
    name: "Nasi Uduk Komplit",
    description: "Nasi uduk + ayam goreng + sambal + lalapan",
    original_price: 25000,
    discount_percent: 60,
    current_price: 10000,
    remaining_portions: 3,
    available_until: inHours(2),
  },
  {
    id: "l2",
    merchant_id: "m1",
    name: "Sayur Lodeh + Nasi",
    description: "Sayur lodeh dengan tahu dan tempe",
    original_price: 18000,
    discount_percent: 50,
    current_price: 9000,
    remaining_portions: 5,
    available_until: inHours(3),
  },
  {
    id: "l3",
    merchant_id: "m2",
    name: "Sate Ayam 10 Tusuk",
    description: "Sate ayam madura dengan bumbu kacang",
    original_price: 30000,
    discount_percent: 70,
    current_price: 9000,
    remaining_portions: 2,
    available_until: inHours(1.5),
  },
  {
    id: "l4",
    merchant_id: "m3",
    name: "Bakso Urat Pedas",
    description: "Bakso urat dengan kuah pedas meledug",
    original_price: 22000,
    discount_percent: 50,
    current_price: 11000,
    remaining_portions: 1,
    available_until: inHours(4),
  },
  {
    id: "l5",
    merchant_id: "m4",
    name: "Roti Bakar Coklat Keju",
    description: "Roti bakar spesial dengan limpahan coklat dan keju",
    original_price: 20000,
    discount_percent: 50,
    current_price: 10000,
    remaining_portions: 4,
    available_until: inHours(1),
  },
  {
    id: "l6",
    merchant_id: "m4",
    name: "Pisang Bakar Coklat",
    description: "Pisang bakar manis dengan taburan keju",
    original_price: 15000,
    discount_percent: 60,
    current_price: 6000,
    remaining_portions: 2,
    available_until: inHours(2),
  },
  {
    id: "l7",
    merchant_id: "m2",
    name: "Sate Kambing 10 Tusuk",
    description: "Sate kambing muda dengan bumbu kecap",
    original_price: 45000,
    discount_percent: 50,
    current_price: 22500,
    remaining_portions: 3,
    available_until: inHours(2.5),
  },
  {
    id: "l8",
    merchant_id: "m1",
    name: "Ayam Goreng Lengkuas",
    description: "Ayam goreng bumbu lengkuas, tanpa nasi",
    original_price: 18000,
    discount_percent: 50,
    current_price: 9000,
    remaining_portions: 4,
    available_until: inHours(3),
  }
];

export const MOCK_ORDERS = [
  {
    id: "order-1",
    listing_id: "l1",
    quantity: 1,
    total_price: 10000,
    status: "paid", // "paid" | "picked_up"
    consumer_name: "Budi Santoso",
    pickup_code: "AB12CD",
  }
];