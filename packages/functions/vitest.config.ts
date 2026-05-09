import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Load .env.test from this package directory before any test runs
    setupFiles: ['src/tests/setup.ts'],
    // Integration tests hit real APIs — give them a generous timeout
    testTimeout: 15_000,
  },
});
