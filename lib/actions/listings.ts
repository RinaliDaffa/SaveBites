/**
 * SaveBites V3 — Listings Server Actions
 *
 * Mutations for merchant-owned listings. The schema has NO listing.status
 * enum — active/paused/sold_out/expired are derived from `is_active`,
 * `is_sold_out`, and `available_until`. Listings reference `merchants.id`
 * (not `profiles.id`), so the merchant row must be resolved from the
 * authenticated user before any insert/update/delete.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ─── Schemas ────────────────────────────────────────────────────

const CATEGORY_ENUM = z.enum(['meals', 'baked', 'produce', 'other']);

const createListingSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(500),
  category: CATEGORY_ENUM,
  originalPrice: z.number().positive(),
  discountedPrice: z.number().positive(),
  quantity: z.number().int().min(1).max(100),
  pickupStart: z.string().datetime(),
  pickupEnd: z.string().datetime(),
  imageUrl: z.string().url().optional().or(z.literal('')),
});

const updateListingSchema = z.object({
  listingId: z.string().uuid(),
  // Optional partial fields
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(500).optional(),
  category: CATEGORY_ENUM.optional(),
  originalPrice: z.number().positive().optional(),
  discountedPrice: z.number().positive().optional(),
  quantity: z.number().int().min(1).max(100).optional(),
  pickupStart: z.string().datetime().optional(),
  pickupEnd: z.string().datetime().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  // Status flags — boolean pair representing active/paused/sold_out/expired
  isActive: z.boolean().optional(),
  isSoldOut: z.boolean().optional(),
});

const deleteListingSchema = z.object({
  listingId: z.string().uuid(),
});

// ─── Result Type ───────────────────────��────────────────────────

export type ActionResult<T = unknown> = {
  success: boolean;
  error?: string;
  data?: T;
};

// ─── Helpers ────────────────────────────────────────────────────

/** Parse a FormData numeric value defensively. */
function parseNumber(raw: FormDataEntryValue | null): number {
  if (typeof raw !== 'string') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Read optional string from FormData, returning undefined when empty. */
function readOptionalString(raw: FormDataEntryValue | null): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

// ─── Create Listing ─────────────────────────────────────────────

export async function createListingAction(
  formData: FormData
): Promise<ActionResult<{ listingId: string }>> {
  const imageUrl = readOptionalString(formData.get('imageUrl'));

  const parsed = createListingSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
    category: formData.get('category'),
    originalPrice: parseNumber(formData.get('originalPrice')),
    discountedPrice: parseNumber(formData.get('discountedPrice')),
    quantity: parseNumber(formData.get('quantity')),
    pickupStart: formData.get('pickupStart'),
    pickupEnd: formData.get('pickupEnd'),
    imageUrl,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Input tidak valid',
    };
  }

  // Cross-field invariants — the DB also enforces these via CHECK constraints,
  // but a clean error here is friendlier than a PostgREST 400.
  if (parsed.data.discountedPrice >= parsed.data.originalPrice) {
    return { success: false, error: 'Harga diskon harus lebih kecil dari harga asli' };
  }
  if (new Date(parsed.data.pickupEnd) <= new Date(parsed.data.pickupStart)) {
    return { success: false, error: 'Waktu pickup selesai harus setelah waktu mulai' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Silakan login terlebih dahulu' };

  // Resolve the merchant row owned by this profile.
  // Listings.merchant_id is FK to merchants.id; RLS only allows inserting
  // when the merchant row's owner_id matches auth.uid().
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!merchant) {
    return { success: false, error: 'Hanya merchant yang dapat membuat listing' };
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .insert({
      merchant_id: merchant.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      original_price: parsed.data.originalPrice,
      surplus_price: parsed.data.discountedPrice,
      quantity_available: parsed.data.quantity,
      available_from: parsed.data.pickupStart,
      available_until: parsed.data.pickupEnd,
      image_url: imageUrl ?? null,
      is_active: true,
      is_sold_out: false,
    })
    .select('id')
    .single();

  if (error || !listing) {
    console.error('[CREATE LISTING ERROR]', error);
    return { success: false, error: 'Gagal membuat listing' };
  }

  revalidatePath('/m/listings');
  revalidatePath('/m/dashboard');
  revalidatePath('/c/discover');
  redirect('/m/listings');
}

// ─── Update Listing ─────────────────────────────────────────────

export async function updateListingAction(formData: FormData): Promise<ActionResult> {
  const rawListingId = formData.get('listingId');
  if (typeof rawListingId !== 'string') {
    return { success: false, error: 'Listing ID tidak valid' };
  }

  // Build payload from present fields — only include those supplied.
  const updatePayload: Record<string, unknown> = {};

  const title = readOptionalString(formData.get('title'));
  if (title) updatePayload.title = title;

  const description = readOptionalString(formData.get('description'));
  if (description) updatePayload.description = description;

  const category = readOptionalString(formData.get('category'));
  if (category) updatePayload.category = category;

  const originalPriceRaw = formData.get('originalPrice');
  if (typeof originalPriceRaw === 'string' && originalPriceRaw.trim() !== '') {
    updatePayload.original_price = parseNumber(originalPriceRaw);
  }

  const discountedPriceRaw = formData.get('discountedPrice');
  if (typeof discountedPriceRaw === 'string' && discountedPriceRaw.trim() !== '') {
    updatePayload.surplus_price = parseNumber(discountedPriceRaw);
  }

  const quantityRaw = formData.get('quantity');
  if (typeof quantityRaw === 'string' && quantityRaw.trim() !== '') {
    updatePayload.quantity_available = parseNumber(quantityRaw);
  }

  const pickupStart = readOptionalString(formData.get('pickupStart'));
  if (pickupStart) updatePayload.available_from = pickupStart;

  const pickupEnd = readOptionalString(formData.get('pickupEnd'));
  if (pickupEnd) updatePayload.available_until = pickupEnd;

  const imageUrl = readOptionalString(formData.get('imageUrl'));
  if (imageUrl !== undefined) updatePayload.image_url = imageUrl || null;

  const isActiveRaw = formData.get('isActive');
  if (typeof isActiveRaw === 'string') {
    updatePayload.is_active = isActiveRaw === 'true' || isActiveRaw === '1';
  }

  const isSoldOutRaw = formData.get('isSoldOut');
  if (typeof isSoldOutRaw === 'string') {
    updatePayload.is_sold_out = isSoldOutRaw === 'true' || isSoldOutRaw === '1';
  }

  const parsed = updateListingSchema.safeParse({
    listingId: rawListingId,
    ...updatePayload,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Input tidak valid',
    };
  }

  // Cross-field invariants when both prices are supplied.
  if (
    typeof updatePayload.original_price === 'number' &&
    typeof updatePayload.surplus_price === 'number' &&
    updatePayload.surplus_price >= updatePayload.original_price
  ) {
    return { success: false, error: 'Harga diskon harus lebih kecil dari harga asli' };
  }
  if (
    typeof updatePayload.available_from === 'string' &&
    typeof updatePayload.available_until === 'string' &&
    new Date(updatePayload.available_until as string) <=
      new Date(updatePayload.available_from as string)
  ) {
    return { success: false, error: 'Waktu pickup selesai harus setelah waktu mulai' };
  }

  if (Object.keys(updatePayload).length === 0) {
    return { success: false, error: 'Tidak ada perubahan yang dikirimkan' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Silakan login terlebih dahulu' };

  // RLS will block unauthorized updates, but we also do an explicit
  // ownership check via the merchant row to give a cleaner error.
  const { data: listing } = await supabase
    .from('listings')
    .select('merchant_id, merchants!inner(owner_id)')
    .eq('id', rawListingId)
    .maybeSingle();

  if (!listing) return { success: false, error: 'Listing tidak ditemukan' };

  const ownerId = (listing as unknown as {
    merchants: { owner_id: string } | { owner_id: string }[];
  }).merchants;
  const ownerIdStr = Array.isArray(ownerId) ? ownerId[0]?.owner_id : ownerId?.owner_id;
  if (ownerIdStr !== user.id) {
    return { success: false, error: 'Tidak memiliki akses' };
  }

  const { error } = await supabase
    .from('listings')
    .update(updatePayload)
    .eq('id', rawListingId);

  if (error) {
    console.error('[UPDATE LISTING ERROR]', error);
    return { success: false, error: 'Gagal mengupdate listing' };
  }

  revalidatePath('/m/listings');
  revalidatePath(`/c/listing/${rawListingId}`);
  revalidatePath('/c/discover');
  return { success: true };
}

// ─── Toggle Pause/Resume (action helper) ────────────────────────

/**
 * Convenience action used by the merchant listings index.
 * The PATCH endpoint at /api/listings/[id] already supports pause/resume,
 * but this gives form-based callers (e.g. inline forms) a single call.
 */
export async function toggleListingPauseAction(
  formData: FormData
): Promise<ActionResult> {
  const listingId = formData.get('listingId');
  const action = formData.get('action');
  if (typeof listingId !== 'string') {
    return { success: false, error: 'Listing ID tidak valid' };
  }
  if (action !== 'pause' && action !== 'resume') {
    return { success: false, error: 'Aksi tidak valid' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Silakan login terlebih dahulu' };

  const { error } = await supabase
    .from('listings')
    .update({ is_active: action === 'resume' })
    .eq('id', listingId);

  if (error) {
    console.error('[TOGGLE LISTING ERROR]', error);
    return { success: false, error: 'Gagal mengubah status listing' };
  }

  revalidatePath('/m/listings');
  revalidatePath('/c/discover');
  return { success: true };
}

// ─── Delete Listing ─────────────────────────────────────────────

export async function deleteListingAction(formData: FormData): Promise<ActionResult> {
  const rawListingId = formData.get('listingId');
  if (typeof rawListingId !== 'string') {
    return { success: false, error: 'Listing ID tidak valid' };
  }

  const parsed = deleteListingSchema.safeParse({ listingId: rawListingId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Listing ID tidak valid' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Silakan login terlebih dahulu' };

  // Block deletion when active orders reference the listing.
  const { count: activeOrderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('listing_id', rawListingId)
    .in('status', ['pending', 'paid', 'ready']);

  if (activeOrderCount && activeOrderCount > 0) {
    return {
      success: false,
      error: 'Tidak dapat menghapus listing dengan pesanan aktif',
    };
  }

  // Ownership check via merchant join.
  const { data: listing } = await supabase
    .from('listings')
    .select('merchant_id, merchants!inner(owner_id)')
    .eq('id', rawListingId)
    .maybeSingle();

  if (!listing) return { success: false, error: 'Listing tidak ditemukan' };

  const owner = (listing as unknown as {
    merchants: { owner_id: string } | { owner_id: string }[];
  }).merchants;
  const ownerId = Array.isArray(owner) ? owner[0]?.owner_id : owner?.owner_id;
  if (ownerId !== user.id) {
    return { success: false, error: 'Tidak memiliki akses' };
  }

  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', rawListingId);

  if (error) {
    console.error('[DELETE LISTING ERROR]', error);
    return { success: false, error: 'Gagal menghapus listing' };
  }

  revalidatePath('/m/listings');
  revalidatePath('/c/discover');
  return { success: true };
}