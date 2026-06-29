/**
 * SaveBites V3 — Listing Validation Schemas
 * Zod schemas for creating and updating surplus meal listings.
 */

import { z } from 'zod';

export const createListingSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().max(500, 'Description must be under 500 characters').optional(),
  originalPrice: z.number().positive('Original price must be positive'),
  surplusPrice: z.number().positive('Surplus price must be positive').refine(
    (val) => val < (val as number),
    { message: 'Surplus price must be less than original price' }
  ),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  category: z.string().default('main'),
  availableUntil: z.union([z.string(), z.number(), z.date()]),
  dietaryTags: z.array(z.string()).optional(),
});

export type CreateListingForm = z.infer<typeof createListingSchema>;

/** Discount calculation helper schema */
export const discountSchema = z.object({
  originalPrice: z.number().positive(),
  discountPercent: z.number().min(0).max(90),
});

export type DiscountForm = z.infer<typeof discountSchema>;

/** Available food categories */
export const CATEGORY_OPTIONS = [
  { value: 'main', label: 'Main Course' },
  { value: 'snack', label: 'Snack' },
  { value: 'drink', label: 'Drink' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'bakery', label: 'Bakery' },
] as const;

/** Dietary tag options */
export const DIETARY_TAGS = [
  { value: 'halal', label: 'Halal' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'nut-free', label: 'Nut Free' },
  { value: 'gluten-free', label: 'Gluten Free' },
  { value: 'dairy-free', label: 'Dairy Free' },
] as const;

/** Categories available for the filter bar */
export const FILTER_CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'rice', label: 'Rice Meals' },
  { value: 'noodle', label: 'Noodles' },
  { value: 'snack', label: 'Snacks' },
  { value: 'drink', label: 'Drinks' },
  { value: 'dessert', label: 'Desserts' },
  { value: 'bakery', label: 'Bakery' },
] as const;

/** Radius options in meters */
export const RADIUS_OPTIONS = [
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
] as const;

/** Price cap options */
export const PRICE_CAP_OPTIONS = [
  { value: 20000, label: 'Under Rp 20k' },
  { value: 50000, label: 'Under Rp 50k' },
  { value: 100000, label: 'Under Rp 100k' },
] as const;
