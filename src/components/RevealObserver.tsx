'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Révélation au défilement : un bloc monte et s'affiche quand il entre dans
 * l'écran, une seule fois.
 *
 * Un observateur unique pour toute la page, plutôt qu'un composant par bloc :
 * les écrans du back-office sont écrits en styles inline et n'auraient pas
 * supporté d'être emballés dans un conteneur supplémentaire (grilles, hauteurs
 * de cartes). Il suffit ici d'une classe `rv` sur un élément, ou de
 * `data-rv-auto` sur un conteneur dont les enfants directs sont révélés en
 * cascade.
 *
 * L'animation elle-même est en CSS, conditionnée à la classe `js-reveal` posée
 * par le script de tête (layout.tsx) : sans JavaScript, ou si l'utilisateur
 * refuse les animations, tout reste visible et immobile.
 */

// Décalage entre deux blocs voisins, plafonné pour que le bas d'une longue
// liste n'attende pas une seconde avant d'apparaître.
const STAGGER_MS = 70;
const STAGGER_MAX = 6;

function tagChildren(container: HTMLElement): void {
  Array.from(container.children).forEach((node, i) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.classList.contains('rv') || node.classList.contains('rv-in')) return;
    // Un élément en position fixe (voile de modale) est laissé tel quel : le
    // décaler reviendrait à déplacer une surface censée couvrir l'écran.
    if (getComputedStyle(node).position === 'fixed') return;
    node.style.transitionDelay = `${Math.min(i, STAGGER_MAX) * STAGGER_MS}ms`;
    node.classList.add('rv');
  });
}

export function RevealObserver() {
  // Le contenu change à chaque navigation : on retague et on réobserve.
  const pathname = usePathname();

  useEffect(() => {
    // Animations refusées, ou script de tête absent : rien à observer.
    if (!document.documentElement.classList.contains('js-reveal')) return;

    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.rv').forEach((el) => el.classList.add('rv-in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('rv-in');
          io.unobserve(entry.target);
        });
      },
      // Même seuil que le site de référence : le bloc doit être entré d'une
      // bonne marge dans l'écran, pas seulement l'effleurer.
      { rootMargin: '0px 0px -80px 0px' },
    );

    function observeAll(): void {
      document.querySelectorAll<HTMLElement>('[data-rv-auto]').forEach(tagChildren);
      document.querySelectorAll<HTMLElement>('.rv:not(.rv-in)').forEach((el) => io.observe(el));
    }

    observeAll();

    // Les écrans connectés affichent leurs sections après le retour du réseau :
    // sans cette surveillance, tout ce qui arrive plus tard ne serait jamais
    // tagué (donc visible, mais sans animation).
    //
    // Le tableau de bord se met à jour en continu (Realtime) : on regroupe les
    // mutations sur une frame plutôt que de balayer le document à chaque ligne
    // insérée.
    let queued = 0;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        observeAll();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (queued) cancelAnimationFrame(queued);
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
