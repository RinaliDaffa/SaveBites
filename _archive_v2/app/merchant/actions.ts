'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function createListing(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const imageUrl = String(formData.get('imageUrl') ?? '').trim() || null;
  const originalPrice = Number(formData.get('originalPrice'));
  const discountPct = Number(formData.get('discountPct'));
  const portions = Number(formData.get('portions'));
  const pickupDeadline = String(formData.get('pickupDeadline') ?? '');

  if (!title || !originalPrice || !discountPct || !portions || !pickupDeadline) {
    return { error: 'Missing required fields' };
  }
  if (originalPrice <= 0 || discountPct < 0 || discountPct > 90 || portions <= 0) {
    return { error: 'Invalid values' };
  }
  if (new Date(pickupDeadline) <= new Date()) {
    return { error: 'Pickup deadline must be in the future' };
  }

  const { data, error } = await supabase
    .from('listings')
    .insert({
      merchant_id: user.id,
      title,
      description,
      image_url: imageUrl,
      original_price: originalPrice,
      discount_pct: discountPct,
      portions_left: portions,
      portions_total: portions,
      pickup_deadline: pickupDeadline,
      status: 'active',
    })
    .select()
    .single();
  if (error) return { error: error.message };

  revalidatePath('/merchant');
  return { data };
}

export async function cancelListing(listingId: string) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('listings')
    .update({ status: 'cancelled' })
    .eq('id', listingId)
    .eq('merchant_id', user.id)
    .in('status', ['active', 'sold_out']);
  if (error) return { error: error.message };

  revalidatePath('/merchant');
  return { success: true };
}

export async function confirmPickup(qrToken: string) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // 1. Find the order by QR token
  const { data: order, error: oerr } = await supabase
    .from('orders')
    .select('*, listings(merchant_id)')
    .eq('qr_token', qrToken)
    .single();
  if (oerr || !order) return { error: 'Invalid ticket' };
  if (order.status !== 'paid') return { error: `Cannot pickup order in status: ${order.status}` };
  if (new Date(order.pickup_deadline) < new Date()) {
    await supabase
      .from('orders')
      .update({ status: 'expired' })
      .eq('id', order.id);
    return { error: 'Ticket expired' };
  }

  // 2. Verify this merchant owns the listing
  const { data: listing, error: lerr } = await supabase
    .from('listings')
    .select('merchant_id')
    .eq('id', order.listing_id)
    .single();
  if (lerr || !listing || listing.merchant_id !== user.id) {
    return { error: 'Not your order' };
  }

  // 3. Mark as picked up
  const { error: uerr } = await supabase
    .from('orders')
    .update({ status: 'picked_up', picked_up_at: new Date().toISOString() })
    .eq('id', order.id);
  if (uerr) return { error: uerr.message };

  revalidatePath('/merchant/queue');
  return { success: true, orderId: order.id };
}

export async function updateMerchantProfile(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const updates: Record<string, unknown> = {};
  const businessName = String(formData.get('businessName') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const lat = formData.get('lat');
  const lng = formData.get('lng');

  if (businessName) updates.business_name = businessName;
  if (address) updates.address = address;
  if (lat) updates.lat = Number(lat);
  if (lng) updates.lng = Number(lng);

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/merchant');
  return { success: true };
}

/**
 * Form-action wrapper used by the dashboard listing cards' Cancel button.
 * Reads `listingId` from a hidden form field so we can wire the action
 * directly to a <form action={...}>.
 */
export async function cancelListingById(formData: FormData) {
  const id = String(formData.get('listingId') ?? '');
  if (!id) return;
  await cancelListing(id);
}

export async function signOutMerchant() {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/auth/login');
}