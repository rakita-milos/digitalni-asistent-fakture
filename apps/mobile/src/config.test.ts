import { API_URL, IS_DEV_API_URL, PRIVACY_URL, TERMS_URL, WEB_URL, normalizeUrl } from './config';

/**
 * Pravne stranice se otvaraju u browseru (`Linking.openURL`), pa URL-ovi moraju biti apsolutni,
 * https i bez završne kose crte — inače Play listing dobije neispravan link.
 */
describe('javni URL-ovi pravnih stranica', () => {
  it('koristi https i nema završnu kosu crtu', () => {
    expect(WEB_URL.startsWith('https://')).toBe(true);
    expect(WEB_URL.endsWith('/')).toBe(false);
    expect(PRIVACY_URL.startsWith('https://')).toBe(true);
    expect(TERMS_URL.startsWith('https://')).toBe(true);
  });

  it('vodi na /privacy i /terms', () => {
    expect(PRIVACY_URL).toBe(`${WEB_URL}/privacy`);
    expect(TERMS_URL).toBe(`${WEB_URL}/terms`);
  });
});

describe('API URL iz app-config.json', () => {
  it('uklanja završne kose crte i koristi fallback za praznu vrijednost', () => {
    expect(normalizeUrl('https://api.example.ba///', 'http://fallback:3001')).toBe(
      'https://api.example.ba',
    );
    expect(normalizeUrl('', 'http://fallback:3001')).toBe('http://fallback:3001');
    expect(normalizeUrl(undefined, 'http://fallback:3001')).toBe('http://fallback:3001');
  });

  it('prepoznaje razvojni URL (release ga odbija)', () => {
    expect(API_URL).toBe('http://10.0.2.2:3001');
    expect(IS_DEV_API_URL).toBe(true);
  });
});
