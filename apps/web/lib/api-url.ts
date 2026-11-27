/**
 * Jedan izvor `API_URL` za web (server, server actions, middleware i PDF proxy).
 *
 * Ako na Vercelu/Railway-u zaboraviš `API_URL`, Next bi tiho koristio localhost i sve stranice
 * bi padale sa nejasnom greškom. Zato u produkciji ispisujemo jasno upozorenje u log.
 */

const FALLBACK_API_URL = 'http://localhost:3001';

export const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? FALLBACK_API_URL;

export const API_URL_IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/.test(API_URL);

if (process.env.NODE_ENV === 'production' && API_URL_IS_LOCAL) {
  console.warn(
    '[config] API_URL nije postavljen — koristi se localhost. Postavi API_URL na hosting okruženju.',
  );
}
