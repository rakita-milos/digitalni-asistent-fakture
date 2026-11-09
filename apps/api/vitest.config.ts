import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * NestJS zahtijeva dekoratore + `emitDecoratorMetadata` (design:paramtypes) da bi DI radio.
 * Vitest-ov esbuild to ne podržava, zato SWC sa eksplicitnim legacyDecorator/decoratorMetadata.
 *
 * E2E testovi koriste pravu bazu (Postgres) i Redis; zato se izvršavaju serijski.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    globals: true,
    // Jedan fork za sve fajlove (manje procesa => stabilnije na Windowsu sa native modulima),
    // a `fileParallelism: false` drži redoslijed jer testovi dijele bazu i truncate-uju je.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    // Bootstrap Nest aplikacije (Nest DI + Prisma + pdfkit/qrcode import) traje > 10 s na hladno.
    hookTimeout: 60_000,
    testTimeout: 30_000,
    setupFiles: ['test/setup.ts'],
  },
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
      module: { type: 'es6' },
    }),
  ],
});
