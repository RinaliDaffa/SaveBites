/**
 * SaveBites V3 — Checkout Page (Server Component)
 * Renders the checkout client with order data fetched from Supabase.
 */

import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { CheckoutClient } from './CheckoutClient';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const supabase = await createClient();

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  // Fetch order with listing + merchant info
  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `
        *,
        listings(
          title,
          description,
          image_url,
          surplus_price,
          merchants(name, address)
        )
      `
    )
    .eq('id', orderId)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  // Ownership check
  if (order.consumer_id !== user.id) {
    return notFound();
  }

  return <CheckoutClient order={order} />;
}
