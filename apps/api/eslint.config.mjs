import base from '@digitalni-asistent/config/eslint/base';

export default [
  ...base,
  {
    // NestJS DI koristi `emitDecoratorMetadata`: klase u constructor parametrima
    // moraju biti VALUE importi. `import type` ih briše i ruši DI, zato je pravilo
    // isključeno za API (vidi vitest.config.ts i tsconfig).
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
