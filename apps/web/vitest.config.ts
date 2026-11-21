import { defineConfig } from 'vitest/config';

/**
 * Unit testovi web helpera (format, obračun, konverzije za formu) i server instrumentacije.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'instrumentation.test.ts'],
  },
});
