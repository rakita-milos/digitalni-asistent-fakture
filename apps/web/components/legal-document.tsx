import type { ReactNode } from 'react';

import {
  LEGAL_DISCLAIMER,
  LEGAL_UPDATED_AT,
  LEGAL_UPDATED_ISO,
  LEGAL_VERSION,
  type LegalSection,
} from '@/lib/legal';

interface LegalDocumentProps {
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

function Section({ section }: { section: LegalSection }): ReactNode {
  return (
    <section className="mt-6">
      <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
      {section.paragraphs.map((paragraph) => (
        <p key={paragraph} className="mt-2 text-sm leading-6 text-foreground/80">
          {paragraph}
        </p>
      ))}
      {section.items ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/80">
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Zajednički prikaz pravnog dokumenta (server komponenta, bez klijentskog stanja). */
export function LegalDocument({ title, intro, sections }: LegalDocumentProps): ReactNode {
  return (
    <article className="rounded-[var(--radius-card)] bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
      <p className="text-sm font-medium tracking-wide text-primary uppercase">Digitalni Asistent</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-1 text-sm text-foreground/60">
        Verzija {LEGAL_VERSION} ·{' '}
        <time dateTime={LEGAL_UPDATED_ISO}>{LEGAL_UPDATED_AT}</time>
      </p>

      <p
        role="note"
        data-testid="legal-disclaimer"
        className="mt-4 rounded-[var(--radius-button)] bg-amber-50 p-3 text-sm leading-6 text-amber-900"
      >
        {LEGAL_DISCLAIMER}
      </p>

      <p className="mt-4 text-sm leading-6 text-foreground/80">{intro}</p>

      {sections.map((section) => (
        <Section key={section.id} section={section} />
      ))}

      <p className="mt-8 border-t border-black/5 pt-4 text-xs text-foreground/50">
        Kontakt za pitanja o obradi podataka i ovim uslovima: {'<e-mail>'} (popunjava se prije objave).
      </p>
    </article>
  );
}
