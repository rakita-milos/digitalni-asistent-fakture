import { describe, expect, it } from 'vitest';

import {
  LEGAL_DISCLAIMER,
  LEGAL_PROCESSORS,
  LEGAL_UPDATED_AT,
  LEGAL_UPDATED_ISO,
  LEGAL_VERSION,
  PRIVACY_SECTIONS,
  TERMS_SECTIONS,
  type LegalSection,
} from './legal';

/**
 * Placeholderi koje firma mora popuniti prije objave. Test pada ako se neki izgubi ili doda
 * bez svijesti o tome — bolje da padne ovdje nego da se objavi `<...>` na Play listingu.
 */
const EXPECTED_PLACEHOLDERS = [
  '<naziv firme>',
  '<adresa>',
  '<JIB>',
  '<e-mail>',
  '<zakonski rok>',
  '<ime provajdera>',
  '<politika povrata>',
  '<nivo SLA>',
  '<mjesto>',
];

function collectText(sections: readonly LegalSection[]): string {
  return sections
    .flatMap((section) => [section.title, ...section.paragraphs, ...(section.items ?? [])])
    .join('\n');
}

describe('pravni tekstovi', () => {
  it('ima verziju i datum u očekivanom formatu', () => {
    expect(LEGAL_VERSION).toMatch(/^\d+\.\d+$/);
    expect(LEGAL_UPDATED_AT).toMatch(/^\d{2}\.\d{2}\.\d{4}\.$/);
    expect(LEGAL_UPDATED_ISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${LEGAL_UPDATED_ISO}T00:00:00Z`).toISOString().slice(0, 10)).toBe(
      LEGAL_UPDATED_ISO,
    );
  });

  it('označava dokument kao radnu verziju za pravnika', () => {
    expect(LEGAL_DISCLAIMER.toLowerCase()).toContain('radna verzija');
    expect(LEGAL_DISCLAIMER.toLowerCase()).toContain('pravnik');
  });

  it('ima jedinstvene i neprazne sekcije u oba dokumenta', () => {
    for (const sections of [PRIVACY_SECTIONS, TERMS_SECTIONS]) {
      const ids = sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(sections.length).toBeGreaterThanOrEqual(10);

      for (const section of sections) {
        expect(section.title.trim().length).toBeGreaterThan(3);
        expect(section.paragraphs.length).toBeGreaterThan(0);
        expect(section.paragraphs.every((paragraph) => paragraph.trim().length > 20)).toBe(true);
      }
    }
  });

  it('pokriva obavezne teme politike privatnosti', () => {
    const text = collectText(PRIVACY_SECTIONS).toLowerCase();

    for (const topic of [
      'rukovalac',
      'podprocesor',
      'prenos podataka',
      'rok',
      'pristup',
      'ispravk',
      'brisanje',
      'prenosivost',
      'prigovor',
      'pritužb',
      'kolačić',
      'bezbjednost',
    ]) {
      expect(text).toContain(topic);
    }
  });

  it('navodi sve podprocesore iz pravnog drafta', () => {
    const text = collectText(PRIVACY_SECTIONS);

    for (const processor of LEGAL_PROCESSORS) {
      expect(text).toContain(processor);
    }
    expect(LEGAL_PROCESSORS.length).toBeGreaterThanOrEqual(6);
  });

  it('jasno označava mock fiskalizaciju i PRAČUN u uslovima', () => {
    const text = collectText(TERMS_SECTIONS);

    expect(text).toContain('PRAČUN');
    expect(text).toContain('ESIR');
    expect(text.toLowerCase()).toContain('mock');
  });

  it('čuva sve placeholdere koje firma mora popuniti', () => {
    const all = `${collectText(PRIVACY_SECTIONS)}\n${collectText(TERMS_SECTIONS)}`;

    for (const placeholder of EXPECTED_PLACEHOLDERS) {
      expect(all).toContain(placeholder);
    }
  });

  it('nema lorem ipsum ni prazne sekcije', () => {
    const all = `${collectText(PRIVACY_SECTIONS)}\n${collectText(TERMS_SECTIONS)}`.toLowerCase();

    expect(all).not.toContain('lorem ipsum');
    expect(all).not.toContain('todo');
    expect(all).not.toContain('tbd');
  });
});
