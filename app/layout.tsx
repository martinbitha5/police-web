import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Boarding Scanner — Superviseur',
  description: 'Dashboard anti-fraude bagages',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
