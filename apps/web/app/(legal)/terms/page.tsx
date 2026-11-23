import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { LegalDocument } from '@/components/legal-document';
import { TERMS_SECTIONS } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Uslovi korištenja · Digitalni Asistent',
  description:
    'Uslovi korištenja usluge Digitalni Asistent: nalog, pretplata, prihvatljivo korištenje, fiskalizacija i odgovornost.',
  robots: { index: true, follow: true },
};

export default function TermsPage(): ReactNode {
  return (
    <LegalDocument
      title="Uslovi korištenja"
      intro="Ovi uslovi uređuju korištenje usluge Digitalni Asistent. Kreiranjem naloga ili korištenjem aplikacije prihvataš ove uslove i Politiku privatnosti."
      sections={TERMS_SECTIONS}
    />
  );
}
