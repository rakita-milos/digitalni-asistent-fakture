/**
 * Imena i trajanje sesijskih cookie-ja — dijele ih server akcije, session helper
 * i middleware (Edge runtime ne smije importovati `next/headers`).
 */
export const ACCESS_COOKIE = 'da_access';
export const REFRESH_COOKIE = 'da_refresh';

/** Access token 15 min, refresh 30 dana (MASTER PROMPT §2, §10). */
export const ACCESS_COOKIE_MAX_AGE = 15 * 60;
export const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
