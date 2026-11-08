import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { APP_NAME } from '@digitalni-asistent/shared';

import './globals.css';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Fakturisanje i naplata za mikro-poduzeća u Republici Srpskoj',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bs">
      <body>{children}</body>
    </html>
  );
}
