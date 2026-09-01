'use client';

import { createContext, useContext } from 'react';
import type { Profile } from '@police/shared';
import type { PartnerBrand } from '@/lib/partner';

/**
 * Contextes de session, dans leur propre module.
 *
 * Le Footer en a besoin et il sert aussi les pages publiques (vitrine, pages
 * légales). Les lire depuis AppShell y embarquerait tout le back-office
 * (client Supabase, navigation, drawer) dans le bundle de la vitrine, et
 * créerait un cycle d'import AppShell → Footer → AppShell.
 *
 * Hors de l'AppShell, les deux hooks renvoient null : côté vitrine, aucun
 * profil et aucun logo de compagnie ne sont affichés.
 */

export const SessionCtx = createContext<Profile | null>(null);

export function useSession(): Profile | null {
  return useContext(SessionCtx);
}

// Marque partenaire de la compagnie du profil, null tant qu'elle est inconnue.
// Contexte séparé de la session : le Footer en a besoin sans porter tout le profil.
export const PartnerCtx = createContext<PartnerBrand | null>(null);

export function usePartner(): PartnerBrand | null {
  return useContext(PartnerCtx);
}
