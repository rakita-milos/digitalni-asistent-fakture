import { describe, expect, it } from 'vitest';

import { emailSchema, jibSchema, phoneSchema, uuidV7Schema } from './validation';

describe('jibSchema', () => {
  it('prihvata JIB od 13 cifara', () => {
    expect(jibSchema.parse('1234567890123')).toBe('1234567890123');
  });

  it('trimuje okolne razmake', () => {
    expect(jibSchema.parse(' 1234567890123 ')).toBe('1234567890123');
  });

  it('odbija 12 i 14 cifara', () => {
    expect(jibSchema.safeParse('123456789012').success).toBe(false);
    expect(jibSchema.safeParse('12345678901234').success).toBe(false);
  });

  it('odbija slova i crtice', () => {
    expect(jibSchema.safeParse('12345678901AB').success).toBe(false);
    expect(jibSchema.safeParse('1234-56789012').success).toBe(false);
  });
});

describe('phoneSchema', () => {
  it('prihvata +387 sa 8 cifara', () => {
    expect(phoneSchema.parse('+38766123456')).toBe('+38766123456');
  });

  it('odbija domaći zapis bez +387', () => {
    expect(phoneSchema.safeParse('066123456').success).toBe(false);
  });

  it('odbija druge pozivne brojeve', () => {
    expect(phoneSchema.safeParse('+38666123456').success).toBe(false);
  });

  it('odbija predugačak broj', () => {
    expect(phoneSchema.safeParse('+387661234567').success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('prihvata ispravan e-mail', () => {
    expect(emailSchema.parse('vlasnik@firma.ba')).toBe('vlasnik@firma.ba');
  });

  it('odbija e-mail bez domena', () => {
    expect(emailSchema.safeParse('vlasnik@').success).toBe(false);
  });
});

describe('uuidV7Schema', () => {
  it('prihvata UUID v7', () => {
    expect(uuidV7Schema.parse('01890a5d-ac96-774b-bcce-b302099a8057')).toBe(
      '01890a5d-ac96-774b-bcce-b302099a8057',
    );
  });

  it('odbija UUID v4', () => {
    expect(uuidV7Schema.safeParse('01890a5d-ac96-474b-bcce-b302099a8057').success).toBe(false);
  });
});
