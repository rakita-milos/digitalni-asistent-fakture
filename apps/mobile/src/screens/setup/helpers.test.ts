import {
  buildCompanyStepInput,
  buildEfdStepInput,
  buildNumberingStepInput,
  buildReminderSettingsInput,
  buildSetupStepInput,
  buildTaxRateInput,
  clampSetupStep,
  formatNumberPreview,
  formatRateBp,
  isValidEmail,
  isValidPhone,
  parseIntegerInRange,
  parseSetupProgress,
  parseTaxPercentBp,
  setupStepHint,
  setupStepLabel,
  setupStepTitle,
} from './helpers';

describe('setup helpers — napredak i koraci', () => {
  it('pravi oznaku „Korak X/5“ i naslove koraka', () => {
    expect(setupStepLabel(0)).toBe('Korak 1/5');
    expect(setupStepLabel(4)).toBe('Korak 5/5');
    expect(setupStepTitle(0)).toBe('Firma');
    expect(setupStepTitle(4)).toBe('Podsjetnici');
    expect(setupStepHint(4)).not.toBe('');
  });

  it('ograničava indeks koraka na 0–4', () => {
    expect(clampSetupStep(-2)).toBe(0);
    expect(clampSetupStep(2)).toBe(2);
    expect(clampSetupStep(9)).toBe(4);
    expect(clampSetupStep(Number.NaN)).toBe(0);
  });

  it('parsira `setup_progress` iz SQLite meta tabele', () => {
    expect(parseSetupProgress(null)).toBe(0);
    expect(parseSetupProgress('0')).toBe(0);
    expect(parseSetupProgress('3')).toBe(3);
    expect(parseSetupProgress('4')).toBe(4);
    expect(parseSetupProgress('7')).toBe(4);
    expect(parseSetupProgress('abc')).toBe(0);
    expect(parseSetupProgress('-1')).toBe(0);
  });
});

describe('setup helpers — validacija koraka 1 (firma)', () => {
  const valid = {
    name: '  Firma DOO  ',
    address: 'Ulica 1',
    city: 'Banja Luka',
    phone: '+38766123456',
    email: 'firma@example.com',
  };

  it('prihvata ispravan unos i trimuje vrijednosti', () => {
    const result = buildCompanyStepInput(valid);

    expect(result).toEqual({
      ok: true,
      input: {
        name: 'Firma DOO',
        address: 'Ulica 1',
        city: 'Banja Luka',
        phone: '+38766123456',
        email: 'firma@example.com',
      },
    });
  });

  it('odbija prazna obavezna polja', () => {
    expect(buildCompanyStepInput({ ...valid, name: ' ' })).toEqual({
      ok: false,
      error: 'Naziv firme je obavezan.',
    });
    expect(buildCompanyStepInput({ ...valid, address: '' }).ok).toBe(false);
    expect(buildCompanyStepInput({ ...valid, city: '' }).ok).toBe(false);
    expect(buildCompanyStepInput({ ...valid, phone: '' }).ok).toBe(false);
    expect(buildCompanyStepInput({ ...valid, email: '' }).ok).toBe(false);
  });

  it('validira telefon +387XXXXXXXX i email', () => {
    expect(isValidPhone('+38766123456')).toBe(true);
    expect(isValidPhone('066123456')).toBe(false);
    expect(isValidPhone('+3876612345')).toBe(false);

    expect(isValidEmail('petar@firma.rs')).toBe(true);
    expect(isValidEmail('petar@firma')).toBe(false);
    expect(isValidEmail('nije-email')).toBe(false);

    const badPhone = buildCompanyStepInput({ ...valid, phone: '066123456' });
    expect(badPhone).toEqual({
      ok: false,
      error: 'Telefon mora biti u formatu +387XXXXXXXX.',
    });
    const badEmail = buildCompanyStepInput({ ...valid, email: 'nije-email' });
    expect(badEmail.ok).toBe(false);
  });
});

describe('setup helpers — validacija koraka 2 (EFD)', () => {
  it('prazno polje šalje null, tekst trimuje', () => {
    expect(buildEfdStepInput('   ')).toEqual({ ok: true, input: { efdId: null } });
    expect(buildEfdStepInput('  EFD-123  ')).toEqual({
      ok: true,
      input: { efdId: 'EFD-123' },
    });
  });

  it('odbija predugačak EFD ID', () => {
    expect(buildEfdStepInput('x'.repeat(101)).ok).toBe(false);
  });
});

describe('setup helpers — korak 3 (porezi)', () => {
  it('parsira procenat sa zarezom i tačkom u bazne poene', () => {
    expect(parseTaxPercentBp('17')).toBe(1700);
    expect(parseTaxPercentBp('17,5')).toBe(1750);
    expect(parseTaxPercentBp('17.5')).toBe(1750);
    expect(parseTaxPercentBp('0')).toBe(0);
    expect(parseTaxPercentBp('100')).toBe(10000);
    expect(parseTaxPercentBp('')).toBeNull();
    expect(parseTaxPercentBp('abc')).toBeNull();
    expect(parseTaxPercentBp('-5')).toBeNull();
    expect(parseTaxPercentBp('100,1')).toBeNull();
  });

  it('građuje ulaz za createTaxRate', () => {
    expect(buildTaxRateInput({ name: ' PDV 17 % ', percent: '17,5', sufCode: ' 17 ' })).toEqual({
      ok: true,
      input: { name: 'PDV 17 %', rateBp: 1750, sufCode: '17', active: true },
    });
  });

  it('odbija neispravne stope', () => {
    expect(buildTaxRateInput({ name: '', percent: '17', sufCode: '17' }).ok).toBe(false);
    expect(buildTaxRateInput({ name: 'PDV', percent: '17', sufCode: '' }).ok).toBe(false);
    expect(buildTaxRateInput({ name: 'PDV', percent: '101', sufCode: '17' }).ok).toBe(false);
  });

  it('formatira bazne poene za prikaz', () => {
    expect(formatRateBp(1700)).toBe('17');
    expect(formatRateBp(1750)).toBe('17,5');
    expect(formatRateBp(1775)).toBe('17,75');
    expect(formatRateBp(0)).toBe('0');
  });
});

describe('setup helpers — korak 4 (numeracija)', () => {
  const valid = {
    numberingPrefix: ' FV ',
    numberingYear: '2026',
    numberingNext: '1',
    defaultDueDays: '15',
  };

  it('građuje ulaz za updateCompany', () => {
    expect(buildNumberingStepInput(valid)).toEqual({
      ok: true,
      input: {
        numberingPrefix: 'FV',
        numberingYear: 2026,
        numberingNext: 1,
        defaultDueDays: 15,
      },
    });
  });

  it('validira opsege godine, broja i roka', () => {
    expect(buildNumberingStepInput({ ...valid, numberingYear: '2019' }).ok).toBe(false);
    expect(buildNumberingStepInput({ ...valid, numberingYear: '2101' }).ok).toBe(false);
    expect(buildNumberingStepInput({ ...valid, numberingNext: '0' }).ok).toBe(false);
    expect(buildNumberingStepInput({ ...valid, defaultDueDays: '366' }).ok).toBe(false);
    expect(buildNumberingStepInput({ ...valid, defaultDueDays: '0' }).ok).toBe(true);
    expect(buildNumberingStepInput({ ...valid, numberingPrefix: 'x'.repeat(21) }).ok).toBe(false);
  });

  it('parsira cijele brojeve i pravi primjer broja fakture', () => {
    expect(parseIntegerInRange('15', 0, 365)).toBe(15);
    expect(parseIntegerInRange(' -5 ', -30, 30)).toBe(-5);
    expect(parseIntegerInRange('1,5', 0, 365)).toBeNull();
    expect(parseIntegerInRange('366', 0, 365)).toBeNull();

    expect(formatNumberPreview('FV', 2026, 1)).toBe('FV2026-0001');
    expect(formatNumberPreview('', 2026, 42)).toBe('2026-0042');
  });
});

describe('setup helpers — korak 5 (podsjetnici)', () => {
  const template = 'Poštovani, račun {broj} na {iznos} dospijeva. Hvala.';

  it('građuje ulaz za updateReminderSettings', () => {
    const result = buildReminderSettingsInput({
      enabled: true,
      templateText: `  ${template}  `,
      offsets: ['-3', '0', '7'],
    });

    expect(result).toEqual({
      ok: true,
      input: {
        enabled: true,
        schedule: [
          { offsetDays: -3, kind: 'sms' },
          { offsetDays: 0, kind: 'sms' },
          { offsetDays: 7, kind: 'sms' },
        ],
        template: { text: template },
      },
    });
  });

  it('zahtijeva {broj} i {iznos} u šablonu', () => {
    expect(
      buildReminderSettingsInput({
        enabled: true,
        templateText: 'Poštovani, račun dospijeva. Hvala vam.',
        offsets: [],
      }),
    ).toEqual({ ok: false, error: 'Šablon mora sadržavati {broj}.' });

    expect(
      buildReminderSettingsInput({
        enabled: true,
        templateText: 'Poštovani, račun {broj} dospijeva. Hvala vam.',
        offsets: [],
      }),
    ).toEqual({ ok: false, error: 'Šablon mora sadržavati {iznos}.' });
  });

  it('validira dužinu šablona i opseg pomaka', () => {
    expect(
      buildReminderSettingsInput({ enabled: false, templateText: 'kratko', offsets: [] }).ok,
    ).toBe(false);
    expect(
      buildReminderSettingsInput({
        enabled: false,
        templateText: 'x'.repeat(501),
        offsets: [],
      }).ok,
    ).toBe(false);

    const tooFar = buildReminderSettingsInput({
      enabled: true,
      templateText: template,
      offsets: ['31'],
    });
    expect(tooFar.ok).toBe(false);

    const tooMany = buildReminderSettingsInput({
      enabled: true,
      templateText: template,
      offsets: ['0', '1', '2', '3', '4'],
    });
    expect(tooMany.ok).toBe(false);

    const invalid = buildReminderSettingsInput({
      enabled: true,
      templateText: template,
      offsets: ['1.5'],
    });
    expect(invalid.ok).toBe(false);
  });

  it('dozvoljava isključene podsjetnike i prazan plan', () => {
    const result = buildReminderSettingsInput({
      enabled: false,
      templateText: template,
      offsets: [],
    });

    expect(result).toEqual({
      ok: true,
      input: { enabled: false, schedule: [], template: { text: template } },
    });
  });
});

describe('setup helpers — buildSetupStepInput po koracima', () => {
  const values = {
    company: {
      name: 'Firma DOO',
      address: 'Ulica 1',
      city: 'Banja Luka',
      phone: '+38766123456',
      email: 'firma@example.com',
    },
    efdId: 'EFD-1',
    numbering: {
      numberingPrefix: 'FV',
      numberingYear: '2026',
      numberingNext: '5',
      defaultDueDays: '15',
    },
  };

  it('vraća ulaz za korake 1, 2 i 4', () => {
    expect(buildSetupStepInput(0, values)?.ok).toBe(true);
    expect(buildSetupStepInput(1, values)).toEqual({ ok: true, input: { efdId: 'EFD-1' } });
    expect(buildSetupStepInput(3, values)?.ok).toBe(true);
  });

  it('za korak „Porezi“ nema grupnog čuvanja', () => {
    expect(buildSetupStepInput(2, values)).toBeNull();
  });
});
