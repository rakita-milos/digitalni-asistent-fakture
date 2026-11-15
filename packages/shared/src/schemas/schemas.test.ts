import { describe, expect, it } from 'vitest';

import {
  changePasswordSchema,
  createCustomerSchema,
  createItemSchema,
  createTaxRateSchema,
  listQuerySchema,
  loginSchema,
  registerSchema,
  updateCompanySchema,
  updateCustomerSchema,
  updateItemSchema,
  updateProfileSchema,
} from '..';

const validCompany = {
  name: 'Majstor d.o.o.',
  jib: '1234567890123',
  address: 'Kralja Petra I 1',
  city: 'Banja Luka',
  phone: '+38766123456',
  email: 'firma@example.ba',
};

describe('registerSchema (§6 /auth/register)', () => {
  it('prihvata firmu + vlasnika i primjenjuje default-e', () => {
    const parsed = registerSchema.parse({
      company: validCompany,
      owner: { email: 'vlasnik@example.ba', phone: '+38766123457', password: 'lozinka123' },
    });
    expect(parsed.company.numberingPrefix).toBe('');
    expect(parsed.company.defaultDueDays).toBe(15);
  });

  it('odbija neispravan JIB u firmi', () => {
    expect(
      registerSchema.safeParse({
        company: { ...validCompany, jib: '123' },
        owner: { email: 'v@example.ba', phone: '+38766123457', password: 'lozinka123' },
      }).success,
    ).toBe(false);
  });

  it('odbija prekratku lozinku', () => {
    expect(
      registerSchema.safeParse({
        company: validCompany,
        owner: { email: 'v@example.ba', phone: '+38766123457', password: 'kratka' },
      }).success,
    ).toBe(false);
  });
});

describe('loginSchema (§6 /auth/login)', () => {
  it('prihvata email ili telefon kao identifier', () => {
    expect(loginSchema.parse({ identifier: 'v@example.ba', password: 'x' }).identifier).toBe(
      'v@example.ba',
    );
    expect(loginSchema.parse({ identifier: '+38766123456', password: 'x' }).identifier).toBe(
      '+38766123456',
    );
  });
});

describe('updateCompanySchema (§6 PATCH /company)', () => {
  it('odbija prazan objekat', () => {
    expect(updateCompanySchema.safeParse({}).success).toBe(false);
  });

  it('prihvata djelimičnu izmjenu', () => {
    expect(updateCompanySchema.parse({ city: 'Sarajevo' }).city).toBe('Sarajevo');
  });
});

describe('customer šeme', () => {
  it('prihvata kupca samo sa imenom', () => {
    expect(createCustomerSchema.parse({ name: 'Petar' }).name).toBe('Petar');
  });

  it('odbija neispravan telefon', () => {
    expect(createCustomerSchema.safeParse({ name: 'Petar', phone: '066123456' }).success).toBe(
      false,
    );
  });

  it('dozvoljava arhiviranje kroz archivedAt', () => {
    const parsed = updateCustomerSchema.parse({ archivedAt: new Date().toISOString() });
    expect(typeof parsed.archivedAt).toBe('string');
  });
});

describe('item šeme (§6 POST /items)', () => {
  it('prihvata cijenu u feningu i stopu u bp', () => {
    expect(createItemSchema.parse({ name: 'Kabl', unit: 'kom', priceFening: 250, taxRateBp: 1700 }));
  });

  it('odbija negativnu cijenu i stopu > 10000', () => {
    expect(
      createItemSchema.safeParse({ name: 'Kabl', unit: 'kom', priceFening: -1, taxRateBp: 1700 })
        .success,
    ).toBe(false);
    expect(
      createItemSchema.safeParse({ name: 'Kabl', unit: 'kom', priceFening: 1, taxRateBp: 10001 })
        .success,
    ).toBe(false);
  });
});

describe('updateItemSchema (PATCH /items/:id)', () => {
  it('prihvata djelimičnu izmjenu i arhiviranje', () => {
    expect(updateItemSchema.parse({ priceFening: 500 }).priceFening).toBe(500);
    expect(updateItemSchema.parse({ archivedAt: null }).archivedAt).toBeNull();
  });

  it('odbija prazan objekat i neispravan datum arhive', () => {
    expect(updateItemSchema.safeParse({}).success).toBe(false);
    expect(updateItemSchema.safeParse({ archivedAt: 'juče' }).success).toBe(false);
  });
});

describe('M-12 — profil i lozinka', () => {
  it('updateProfileSchema traži najmanje jedno polje', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
    expect(updateProfileSchema.parse({ phone: '+38766123456' }).phone).toBe('+38766123456');
    expect(updateProfileSchema.safeParse({ phone: '066123456' }).success).toBe(false);
  });

  it('changePasswordSchema traži različitu novu lozinku od 8+ znakova', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'lozinka123', newPassword: 'lozinka123' })
        .success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'lozinka123', newPassword: 'kratka' })
        .success,
    ).toBe(false);
    expect(
      changePasswordSchema.parse({ currentPassword: 'lozinka123', newPassword: 'novaLozinka1' })
        .newPassword,
    ).toBe('novaLozinka1');
  });
});

describe('taxRate šema', () => {
  it('default active = true', () => {
    expect(createTaxRateSchema.parse({ name: 'PDV 17%', rateBp: 1700, sufCode: 'S' }).active).toBe(
      true,
    );
  });
});

describe('listQuerySchema', () => {
  it('koercira stringove iz query parametara i postavlja default-e', () => {
    const parsed = listQuerySchema.parse({ q: 'petar', limit: '10', offset: '20' });
    expect(parsed).toEqual({ q: 'petar', limit: 10, offset: 20 });
  });
});
