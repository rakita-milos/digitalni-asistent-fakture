import { describe, expect, it } from 'vitest';

import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('u produkciji podrazumijeva jedan proxy hop', () => {
    expect(parseTrustProxy(undefined, 'production')).toBe(1);
    expect(parseTrustProxy('', 'production')).toBe(1);
  });

  it('u razvoju i testu je isključen', () => {
    expect(parseTrustProxy(undefined, 'development')).toBe(false);
    expect(parseTrustProxy(undefined, 'test')).toBe(false);
  });

  it('prihvata true, false i broj hopova', () => {
    expect(parseTrustProxy('true', 'production')).toBe(true);
    expect(parseTrustProxy('false', 'production')).toBe(false);
    expect(parseTrustProxy('2', 'production')).toBe(2);
    expect(parseTrustProxy(' 10 ', 'production')).toBe(10);
  });

  it('odbija neispravne vrijednosti', () => {
    expect(() => parseTrustProxy('abc', 'production')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('0', 'production')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('11', 'production')).toThrow(/TRUST_PROXY/);
  });
});
