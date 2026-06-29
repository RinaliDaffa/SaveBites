/**
 * SaveBites V3 — Merchant Server Actions
 * Create merchant profiles from consumer registration flow.
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const merchantSchema = z.object({
  name: z.string().min(1, 'Nama toko wajib diisi').max(200),
  slug: z.string().min(1, 'Slug wajib diisi').max(100).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug hanya boleh huruf kecil, angka, dan tanda hubung'),
  category: z.enum(['restaurant', 'cafe', 'bakery', 'food_truck', 'snack', 'beverage', 'other']).default('restaurant'),
  address: z.string().min(1, 'Alamat wajib diisi').max(500),
  city: z.string().min(1, 'Kota wajib diisi').max(100).default('Yogyakarta'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

export async function createMerchantAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const parsed = merchantSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    category: formData.get('category'),
    address: formData.get('address'),
    city: formData.get('city'),
    latitude: formData.get('latitude'),
    longitude: formData.get('longitude'),
  });

  if (!parsed.success) {
    console.warn('createMerchantAction validation failed:', parsed.error.issues);
    // Field-level validation errors are caught by HTML5 constraints (required, pattern, minLength, maxLength).
    // For server-side validation failures, return gracefully and let browser constraints handle UX.
    return;
  }

  // Check if merchant already exists for this user
  const { data: existing } = await supabase
    .from('merchants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (existing) {
    redirect('/m/dashboard');
  }

  // Insert merchant record and update profile role
  const { error: merchantError } = await supabase.from('merchants').insert({
    owner_id: user.id,
    name: parsed.data.name,
    slug: parsed.data.slug,
    category: parsed.data.category,
    address: parsed.data.address,
    city: parsed.data.city,
    latitude: parsed.data.latitude,
    longitude: parsed.data.longitude,
  });

  if (merchantError) {
    console.error('createMerchantAction — insert error:', merchantError);
    // Check if it's a unique violation (slug collision)
    if (merchantError.code === '23505') {
      redirect('/m/dashboard?error=slug-taken');
    }
    redirect('/m/dashboard?error=create-failed');
  }

  // Update profile role to 'merchant'
  await supabase
    .from('profiles')
    .update({ role: 'merchant' })
    .eq('id', user.id);

  revalidatePath('/');
  redirect('/m/dashboard');
}
