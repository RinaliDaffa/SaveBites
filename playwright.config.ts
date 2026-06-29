import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — SaveBites V3
 *
 * E2E smoke test setup.
 *
 * - Starts `next dev` automatically (slow first compile, but ensures we
 *   test against a real running server rather than a build artifact).
 * - Spins up Chromium + a single worker to keep CI footprint small.
 *
 * NOTE: This config is intentionally minimal. E2E is reserved for happy
 * paths that are unsafe to unit-test (full HTTP round-trips through the
 * Next runtime). Most logic lives in unit tests instead.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});