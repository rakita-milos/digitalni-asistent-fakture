import react from './react.js';

/**
 * React Native dodatak: `__DEV__` global koji Metro ubacuje.
 */
export default [
  ...react,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: { __DEV__: 'readonly' },
    },
  },
];
