/**
 * SaveBites V3 — Seed Script
 * Creates sample data for local development: one merchant, one listing, one order.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from '@supabase/supabase-js';

// --- Env loading ---
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Run: SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> npx tsx scripts/seed.ts');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seed() {
  let merchantUserId: string;
  let consumerUserId: string | null = null;

  // 1. Create a test user (merchant) in Auth
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: 'seed.merchant@savebites.id',
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Benedik Nusantara', role: 'merchant', phone: '+6281200000000' },
  });

  if (authErr) {
    if (authErr.message.includes('already exists')) {
      console.log('  Auth user already exists, reusing...');
      const { data: foundUser } = await admin.auth.admin.listUsers();
      const existing = foundUser.users.find(u => u.email === 'seed.merchant@savebites.id');
      if (existing) {
        merchantUserId = existing.id;
      } else {
        throw authErr;
      }
    } else {
      throw authErr;
    }
  } else {
    merchantUserId = authUser.user.id;
  }

  console.log('  ✅ Auth user created:', merchantUserId);

  // 2. Create a merchant profile
  const { error: merchantErr } = await admin
    .from('merchants')
    .insert({
      owner_id: merchantUserId,
      name: 'Benedik Nusantara',
      slug: 'benedik-nusantara',
      category: 'bakery',
      address: 'Jl. Sosrowijayan No. 123',
      city: 'Yogyakarta',
      latitude: -7.7972,
      longitude: 110.3688,
    });

  if (merchantErr) {
    if (merchantErr.code === '23505') {
      console.log('  Merchant already exists, reusing...');
    } else {
      throw merchantErr;
    }
  } else {
    console.log('  ✅ Merchant created');
  }

  // 3. Get the merchant
  const { data: merchant } = await admin
    .from('merchants')
    .select('id')
    .eq('owner_id', merchantUserId)
    .maybeSingle();

  if (!merchant?.id) {
    throw new Error('Failed to find merchant');
  }

  // 4. Create a surplus listing
  const { error: listingErr } = await admin.from('listings').insert({
    merchant_id: merchant.id,
    title: 'Paket Sarapan Spesial',
    description: 'Roti bakar + kopi susu + salad buah. Tersisa 4 porsi sebelum jam 10 pagi.',
    original_price: 45000,
    surplus_price: 15000,
    quantity_total: 5,
    quantity_available: 3,
    available_until: Math.floor(Date.now() / 1000) + 2 * 3600, // 2 hours from now
    category: 'bakery',
    dietary_tags: ['halal'],
  });

  if (listingErr) {
    if (listingErr.code === '23505') {
      console.log('  Listing already exists, reusing...');
    } else {
      throw listingErr;
    }
  } else {
    console.log('  ✅ Listing created');
  }

  // 5. Create a test user (consumer)
  const { data: consumerAuth, error: consumerAuthErr } = await admin.auth.admin.createUser({
    email: 'seed.consumer@savebites.id',
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { full_name: 'Budi Santoso', role: 'consumer', phone: '+6281200000001' },
  });

  if (consumerAuthErr) {
    if (consumerAuthErr.message.includes('already exists')) {
      console.log('  Consumer auth user already exists, reusing...');
    } else {
      throw consumerAuthErr;
    }
  }

  if (consumerAuth.user?.id) {
    consumerUserId = consumerAuth.user.id;
    console.log('  ✅ Consumer user created:', consumerAuth.user.id);
  }

  // 6. Create an order
  const { error: orderErr } = await admin.from('orders').insert({
    consumer_id: consumerUserId ?? merchantUserId,
    merchant_id: merchant.id,
    listing_id: merchant.id, // approximate
    pickup_code: 'ABC123',
    reservation_code: 'RES-SEED-001',
    quantity: 2,
    item_price: 15000,
    subtotal: 30000,
    service_fee: 3000,
    total: 33000,
    status: 'paid',
    payment_status: 'paid',
  });

  if (orderErr) {
    if (orderErr.code === '23505') {
      console.log('  Order already exists, reusing...');
    } else {
      console.error('  ⚠️  Order insert error:', orderErr);
    }
  } else {
    console.log('  ✅ Order created');
  }

  console.log('\n✅ Seed complete!');
  console.log('  Merchant login: seed.merchant@savebites.id / Password123!');
  console.log('  Consumer login: seed.consumer@savebites.id / Password123!');
}

seed().catch(console.error);
