/**
 * Money-flow integration test.
 *
 * What this test exercises:
 *  1. public.create_order writes subtotal + service_fee + total
 *     correctly (the bug Step 2 fixed).
 *  2. public.confirm_payment transitions a payment and
 *     creates one gross row + one fee row in merchant_ledger.
 *  3. Calling confirm_payment twice does NOT double-write ledger
 *     rows -- the partial unique index (order_id, kind) holds.
 *  4. public.settle_merchant_payouts aggregates a day's settled
 *     orders into one settlement row per merchant with the correct
 *     net = gross - fee.
 *
 * How to run:
 *   supabase start                          # spins up local DB on :54321
 *   psql -h localhost -p 54321 -U postgres   # verify migrations applied
 *   SAVE_BITES_TEST_BASE_URL=http://localhost:54321 \
 *     SAVE_BITES_TEST_SERVICE_ROLE=<service_role> \
 *     npx vitest run tests/integration/money-flow.test.ts
 *
 * Skipped automatically when the test DB env vars are not set.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SAVE_BITES_TEST_BASE_URL;
const SERVICE_KEY = process.env.SAVE_BITES_TEST_SERVICE_ROLE;
const hasDb = !!(URL && SERVICE_KEY);

const describeIf = hasDb ? describe : describe.skip;

describeIf('money flow integration', () => {
  let supabase: SupabaseClient;
  let merchantId: string;
  let consumerId: string;
  let listingId: string;
  let paymentMethodId: string;

  beforeAll(() => {
    supabase = createClient(URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  beforeEach(async () => {
    // Clean slate for each test. Cascades drop orders, payments,
    // merchant_ledger, settlements for our test users.
    await supabase.from('settlements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('merchant_ledger').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('listings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('merchant_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Seed: a consumer profile, a merchant profile, a listing.
    const { data: consumer } = await supabase
      .from('profiles')
      .insert({
        id: '00000000-0000-0000-0000-000000000001',
        role: 'consumer',
        full_name: 'Test Consumer',
        email: 'consumer@test.local',
        phone: '+628000000001',
      })
      .select()
      .single();
    consumerId = consumer!.id;

    const { data: merchant } = await supabase
      .from('profiles')
      .insert({
        id: '00000000-0000-0000-0000-000000000002',
        role: 'merchant',
        full_name: 'Test Merchant',
        email: 'merchant@test.local',
        phone: '+628000000002',
      })
      .select()
      .single();
    merchantId = merchant!.id;

    await supabase.from('merchant_profiles').insert({
      id: merchantId,
      business_name: 'Test Warung',
      payout_account: 'TEST-BANK-001',
    });

    const { data: listing } = await supabase
      .from('listings')
      .insert({
        merchant_id: merchantId,
        title: 'Nasi Box Surprise',
        surplus_price: 15000,
        original_price: 50000,
        quantity: 5,
        available_until: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
        status: 'active',
        category: 'Rice Dishes',
      })
      .select()
      .single();
    listingId = listing!.id;

    const { data: pm } = await supabase
      .from('payment_methods')
      .insert({
        code: 'test_qris',
        label: 'Test QRIS',
        is_active: true,
      })
      .select()
      .single();
    paymentMethodId = pm!.id;
  });

  afterEach(async () => {
    // best-effort teardown; the beforeEach already cleaned up.
  });

  it('create_order writes subtotal, service_fee, and total correctly', async () => {
    const { data, error } = await supabase.rpc('create_order', {
      p_listing_id: listingId,
      p_quantity: 2,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();

    const { data: orders, error: fetchErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', data as string)
      .single();
    expect(fetchErr).toBeNull();

    // 2 meals * 15000 surplus + 3000 fee = 33000
    expect(orders!.subtotal).toBe(30000);
    expect(orders!.service_fee).toBe(3000);
    expect(orders!.total).toBe(33000);
    expect(orders!.status).toBe('pending');
    expect(orders!.consumer_id).toBe(consumerId);
    expect(orders!.merchant_id).toBe(merchantId);
  });

  it('confirm_payment writes one gross row and one fee row to merchant_ledger', async () => {
    const { data: orderId } = await supabase.rpc('create_order', {
      p_listing_id: listingId,
      p_quantity: 2,
    });

    // Create a payments row in pending state so confirm_payment can
    // pick it up. The webhook would do this in real life.
    const { data: payment } = await supabase
      .from('payments')
      .insert({
        order_id: orderId as string,
        consumer_id: consumerId,
        merchant_id: merchantId,
        amount: 33000,
        payment_method: 'test_qris',
        payment_method_id: paymentMethodId,
        status: 'pending',
        midtrans_order_id: `test-midtrans-${orderId}`,
      })
      .select()
      .single();

    const { error: rpcErr } = await supabase.rpc('confirm_payment', {
      p_payment_id: payment!.id,
      p_attempt_status: 'settlement',
    });
    expect(rpcErr).toBeNull();

    const { data: ledger } = await supabase
      .from('merchant_ledger')
      .select('kind, amount_idr')
      .eq('order_id', orderId as string)
      .order('kind');

    expect(ledger).toHaveLength(2);
    expect(ledger![0].kind).toBe('fee');
    expect(Number(ledger![0].amount_idr)).toBe(3000);
    expect(ledger![1].kind).toBe('gross');
    expect(Number(ledger![1].amount_idr)).toBe(30000);
  });

  it('confirm_payment is idempotent -- replay does not double-write the ledger', async () => {
    const { data: orderId } = await supabase.rpc('create_order', {
      p_listing_id: listingId,
      p_quantity: 1,
    });

    const { data: payment } = await supabase
      .from('payments')
      .insert({
        order_id: orderId as string,
        consumer_id: consumerId,
        merchant_id: merchantId,
        amount: 18000,
        payment_method: 'test_qris',
        payment_method_id: paymentMethodId,
        status: 'pending',
        midtrans_order_id: `test-midtrans-replay-${orderId}`,
      })
      .select()
      .single();

    await supabase.rpc('confirm_payment', {
      p_payment_id: payment!.id,
      p_attempt_status: 'settlement',
    });
    // Replay -- Midtrans may deliver the same webhook multiple times.
    const { error: replayErr } = await supabase.rpc('confirm_payment', {
      p_payment_id: payment!.id,
      p_attempt_status: 'settlement',
    });
    expect(replayErr).toBeNull();

    const { data: ledger } = await supabase
      .from('merchant_ledger')
      .select('kind')
      .eq('order_id', orderId as string);

    // Exactly two rows -- one gross, one fee. The partial unique index
    // (order_id, kind) is what makes this safe.
    expect(ledger).toHaveLength(2);
  });

  it('settle_merchant_payouts writes one row per merchant with net = gross - fee', async () => {
    // Create three completed orders today for the same merchant.
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < 3; i++) {
      const { data: orderId } = await supabase.rpc('create_order', {
        p_listing_id: listingId,
        p_quantity: 1,
      });
      const { data: payment } = await supabase
        .from('payments')
        .insert({
          order_id: orderId as string,
          consumer_id: consumerId,
          merchant_id: merchantId,
          amount: 18000,
          payment_method: 'test_qris',
          payment_method_id: paymentMethodId,
          status: 'pending',
          midtrans_order_id: `test-midtrans-batch-${i}-${orderId}`,
        })
        .select()
        .single();
      await supabase.rpc('confirm_payment', {
        p_payment_id: payment!.id,
        p_attempt_status: 'settlement',
      });
      await supabase
        .from('orders')
        .update({
          status: 'picked_up',
          picked_up_at: `${today}T10:00:00Z`,
        })
        .eq('id', orderId as string);
    }

    const { data, error } = await supabase.rpc('settle_merchant_payouts', {
      p_target_date: today,
    });

    expect(error).toBeNull();
    const settlements = data as Array<{
      merchant_id: string;
      period_date: string;
      gross_idr: string;
      fee_idr: string;
      net_idr: string;
      order_count: number;
    }>;
    expect(settlements).toHaveLength(1);
    expect(settlements![0].merchant_id).toBe(merchantId);
    expect(settlements![0].period_date).toBe(today);
    expect(Number(settlements![0].gross_idr)).toBe(45000); // 3 * 15000
    expect(Number(settlements![0].fee_idr)).toBe(9000); // 3 * 3000
    expect(Number(settlements![0].net_idr)).toBe(36000);
    expect(settlements![0].order_count).toBe(3);
  });

  it('settle_merchant_payouts is idempotent across cron replays', async () => {
    const { data: orderId } = await supabase.rpc('create_order', {
      p_listing_id: listingId,
      p_quantity: 1,
    });
    const { data: payment } = await supabase
      .from('payments')
      .insert({
        order_id: orderId as string,
        consumer_id: consumerId,
        merchant_id: merchantId,
        amount: 18000,
        payment_method: 'test_qris',
        payment_method_id: paymentMethodId,
        status: 'pending',
        midtrans_order_id: `test-midtrans-idemp-${orderId}`,
      })
      .select()
      .single();
    await supabase.rpc('confirm_payment', {
      p_payment_id: payment!.id,
      p_attempt_status: 'settlement',
    });
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from('orders')
      .update({ status: 'picked_up', picked_up_at: `${today}T11:00:00Z` })
      .eq('id', orderId as string);

    await supabase.rpc('settle_merchant_payouts', { p_target_date: today });
    await supabase.rpc('settle_merchant_payouts', { p_target_date: today });

    const { data: settlements } = await supabase
      .from('settlements')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('period_date', today);
    expect(settlements).toHaveLength(1);
  });
});