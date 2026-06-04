import { useEffect, useState } from 'react';

/**
 * Renvoie `true` dès que la largeur de l'écran passe sous `maxWidth` (défaut 768 px).
 * Commence à `false` côté serveur pour éviter tout décalage d'hydratation.
 */
export function useIsMobile(maxWidth = 768): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [maxWidth]);
  return mobile;
}
