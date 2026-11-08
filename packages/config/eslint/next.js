import nextPlugin from '@next/eslint-plugin-next';

import react from './react.js';

/**
 * Next.js dodatak: pravila iz @next/eslint-plugin-next (App Router).
 * Bez ovoga `next build` upozorava da plugin nije detektovan u ESLint konfiguraciji.
 */
export default [
  ...react,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
    },
  },
];
