import globals from 'globals';

import react from './react.js';

/**
 * React Native dodatak: `__DEV__` global koji Metro ubacuje i Jest globali
 * u JS test fajlovima (`*.test.js`, `jest.setup.js`).
 */
export default [
  ...react,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: { __DEV__: 'readonly' },
    },
  },
  {
    files: ['**/*.test.{js,jsx}', '**/jest.setup.js'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
];
