'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Sélection portée par l'URL plutôt que par un useState.
 *
 * Un vol ouvert dans le tableau de bord vivait dans la mémoire du composant :
 * actualiser la page (F5) repartait de zéro et renvoyait à la vue d'ensemble.
 * En rangeant la sélection dans un paramètre d'adresse (`?vol=<id>`), le
 * rechargement rouvre exactement le même vol, le bouton Retour du navigateur
 * referme le détail, et l'adresse peut se partager entre superviseurs.
 *
 * `set(id)` empile une entrée d'historique (navigation volontaire) ;
 * `set(id, { replace: true })` remplace l'entrée courante — pour les
 * sélections automatiques, qui ne doivent pas polluer le bouton Retour.
 */
export function useUrlParam(
  key: string,
): [string | null, (value: string | null, opts?: { replace?: boolean }) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const value = searchParams.get(key);

  const set = useCallback(
    (next: string | null, opts?: { replace?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === null || next === '') params.delete(key);
      else params.set(key, next);
      const qs = params.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [key, pathname, router, searchParams],
  );

  return [value, set];
}
