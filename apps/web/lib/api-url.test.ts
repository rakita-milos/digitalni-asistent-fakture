import { describe, expect, it } from 'vitest';

import { API_URL, API_URL_IS_LOCAL } from './api-url';

describe('API_URL (web)', () => {
  it('je apsolutan http(s) URL', () => {
    expect(API_URL).toMatch(/^https?:\/\//);
  });

  it('lokalni fallback je prepoznat', () => {
    const looksLocal = API_URL.startsWith('http://localhost') || API_URL.startsWith('http://127.0.0.1');
    expect(API_URL_IS_LOCAL).toBe(looksLocal);
  });
});
