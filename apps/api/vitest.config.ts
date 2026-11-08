import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * NestJS koristi dekoratore + emitDecoratorMetadata. Vitest-ov esbuild to ne
 * podržava, zato SWC (preporučeni setup za NestJS + Vitest).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    globals: true,
    pool: 'threads',
  },
  plugins: [swc.vite()],
});
