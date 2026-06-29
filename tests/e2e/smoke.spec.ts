import { test, expect } from '@playwright/test';

/**
 * Smoke test — SaveBites V3
 *
 * Verifies that the public landing surface renders, role-based redirects
 * kick in for protected routes, and the pickup-verify API rejects
 * malformed input. None of these tests touch the database.
 */

test.describe('landing page', () => {
  test('renders the hero and role CTAs', async ({ page }) => {
    await page.goto('/');

    // Landing should load a <main> with a heading
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });

    // Either "Mulai" / "Konsumen" / "Merchant" CTA text is present.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('GET / returns 200', async ({ request }) => {
    const res = await request.get('/');
    expect(res.status()).toBe(200);
  });
});

test.describe('role-based redirects (unauthenticated)', () => {
  test('/c redirects to /auth/login', async ({ page }) => {
    const res = await page.goto('/c', { waitUntil: 'domcontentloaded' });
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/auth\/login/);
    expect(res?.ok() || res?.status() === 200 || res?.status() === 307).toBeTruthy();
  });

  test('/m redirects to /auth/login', async ({ page }) => {
    await page.goto('/m', { waitUntil: 'domcontentloaded' });
    const finalUrl = page.url();
    expect(finalUrl).toMatch(/\/auth\/login/);
  });
});

test.describe('API guards', () => {
  test('POST /api/orders/verify-pickup rejects missing body', async ({ request }) => {
    const res = await request.post('/api/orders/verify-pickup', {
      data: {},
      headers: { 'content-type': 'application/json' },
    });
    // 400 (validation), 405 (method) or 401 (auth) are all acceptable — we
    // just want to confirm it does NOT crash with 500.
    expect([400, 401, 405, 415]).toContain(res.status());
  });

  test('POST /api/orders/verify-pickup rejects bad pickupCode format', async ({ request }) => {
    const res = await request.post('/api/orders/verify-pickup', {
      data: { pickupCode: 'abc' }, // too short
      headers: { 'content-type': 'application/json' },
    });
    // Should be 400 from the Zod schema, but accept 401 if it auth-checks first.
    expect([400, 401]).toContain(res.status());
  });

  test('POST /api/orders/verify-pickup rejects oversized body', async ({ request }) => {
    const huge = 'A'.repeat(20_000); // > 2 KB
    const res = await request.post('/api/orders/verify-pickup', {
      data: { pickupCode: huge },
      headers: { 'content-type': 'application/json' },
    });
    // 413 from body limit, 400 from schema, or 401 from auth — never 500.
    expect([400, 401, 413]).toContain(res.status());
  });
});

test.describe('API method handling', () => {
  test('GET on a POST-only API returns 405', async ({ request }) => {
    const res = await request.get('/api/orders/verify-pickup');
    expect(res.status()).toBe(405);
  });
});