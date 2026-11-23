import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { LegalDocument } from '@/components/legal-document';
import { PRIVACY_SECTIONS } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Politika privatnosti · Digitalni Asistent',
  description:
    'Kako Digitalni Asistent obrađuje lične podatke: svrhe, pravni osnovi, podprocesori, rokovi čuvanja i prava korisnika.',
  robots: { index: true, follow: true },
};

export default function PrivacyPage(): ReactNode {
  return (
    <LegalDocument
      title="Politika privatnosti"
      intro="Ova politika objašnjava koje lične podatke Digitalni Asistent obrađuje, zašto ih obrađuje, kome ih povjerava i kakva prava korisnici imaju. Primjenjuje se na web i mobilnu aplikaciju."
      sections={PRIVACY_SECTIONS}
    />
  );
}
