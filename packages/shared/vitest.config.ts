import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 'threads' umjesto 'forks': nema child_process spawn-a (brže i radi u ograničenim okruženjima).
    pool: 'threads',
  },
});
