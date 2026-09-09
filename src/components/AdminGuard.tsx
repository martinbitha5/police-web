'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, useSession } from '@/components/AppShell';

/**
 * Enveloppe une page réservée aux admins : shell + redirection si non-admin.
 * L'accès est aussi contrôlé côté serveur (routes /api/admin et RLS) ; ceci ne
 * fait que masquer l'écran.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <Guard>{children}</Guard>
    </AppShell>
  );
}

function Guard({ children }: { children: ReactNode }) {
  const profile = useSession();
  const router = useRouter();

  useEffect(() => {
    if (profile !== null && profile.role !== 'admin') router.replace('/');
  }, [profile, router]);

  if (profile === null) return null; // chargement
  if (profile.role !== 'admin') return null; // redirection en cours
  return <>{children}</>;
}
