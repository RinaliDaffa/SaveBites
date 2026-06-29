/**
 * SaveBites V3 — Global Constants
 * Central configuration for platform fees, timing, categories, and defaults.
 */

export const SERVICE_FEE_FLAT_IDR = 3000; // Flat platform service fee (R4)
// MUST match the default argument on public.create_order(p_listing_id, p_quantity, p_service_fee)
// in supabase/migrations/00000000000004_money_flow.sql. The DB default is the
// source of truth — the value here is used only for client-side display and
// as a fallback when reading order rows that predate the migration.
export const MAX_PICKUP_WINDOW_HOURS = 3;
export const DISCOVERY_RADIUS_METERS = 2000;
export const RESERVATION_TTL_MINUTES = 30;
export const DEFAULT_CITY = 'Yogyakarta';
export const CURRENCY_CODE = 'IDR';
export const COUNTRY_CODE = 'id';

// Categories
export const CATEGORY_OPTIONS = [
  'Rice Dishes',
  'Noodles',
  'Snacks',
  'Drinks',
  'Bakery',
  'Fruit',
  'Catering',
  'Desserts',
  'Seafood',
  'Other',
] as const;

// Filter constants
export const FILTER_CATEGORIES = [
  { value: 'all', label: 'All' },
  ...CATEGORY_OPTIONS.map(c => ({ value: c, label: c })) as Array<{ value: string; label: string }>,
];

export const RADIUS_OPTIONS = [
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
  { value: 5000, label: '5km' },
];

export const PRICE_CAP_OPTIONS = [
  { value: 20000, label: 'Rp 20k' },
  { value: 30000, label: 'Rp 30k' },
  { value: 50000, label: 'Rp 50k' },
  { value: 100000, label: 'Rp 100k' },
];

// New listing form defaults
export const NEW_LISTING_DEFAULTS = {
  title: 'Surprise Meal Box',
  description: '',
  originalPrice: 50000,
  surplusPrice: 15000,
  quantity: 5,
  availableUntil: Math.floor(Date.now() / 1000) + 4 * 3600, // 4 hours from now
  category: 'Other',
  dietaryTags: ['halal'],
} as const;
