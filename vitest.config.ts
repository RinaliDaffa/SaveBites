import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config — SaveBites V3
 *
 * Scope:
 * - Unit tests in tests/unit/** — pure functions, schema validation,
 *   security primitives. Always run in CI.
 * - Integration tests in tests/integration/** — exercise RPCs against
 *   a real Supabase DB. Require env vars
 *   SAVE_BITES_TEST_BASE_URL + SAVE_BITES_TEST_SERVICE_ROLE to be
 *   set; otherwise the suite is skipped via describe.skip so CI on
 *   minimal runners does not fail.
 *
 * Path alias:
 * - @/* → repo root so tests can import the same paths the runtime code uses.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: ['**/*.d.ts', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});