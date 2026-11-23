import { PRIVACY_URL, TERMS_URL, WEB_URL } from './config';

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
