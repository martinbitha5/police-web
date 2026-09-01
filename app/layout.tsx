import type { ReactNode } from 'react';
import { Inter, Archivo_Black } from 'next/font/google';
import './globals.css';
import { RevealObserver } from '@/components/RevealObserver';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
// Archivo Black — substitut libre de Wise Sans pour les titres display.
const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-archivo' });

export const metadata = {
  title: 'Boarding Scanner · Superviseur',
  description: 'Dashboard anti-fraude bagages',
};

// Récupération des chunks obsolètes après un nouveau déploiement : si un script
// échoue à charger (hash périmé en cache), on recharge proprement une fois.
const CHUNK_RECOVERY = `(function(){function c(m){return /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i.test(m||'')}function r(){try{var k='__chunk_reload_ts',l=+sessionStorage.getItem(k)||0;if(Date.now()-l>10000){sessionStorage.setItem(k,Date.now());location.reload()}}catch(e){}}window.addEventListener('error',function(e){var t=e&&e.target;if(c(e&&e.message)||(t&&(t.tagName==='SCRIPT'||t.tagName==='LINK'))){r()}},true);window.addEventListener('unhandledrejection',function(e){var x=e&&e.reason;if(c(x&&(x.message||String(x)))){r()}});})();`;

// Animations au défilement — posé avant la première peinture, jamais après :
//  - `js-reveal` autorise le masquage initial des blocs. Sans ce script (JS
//    coupé) ou si l'utilisateur refuse les animations, la classe n'est pas
//    posée et tout le contenu reste visible : rien ne peut rester invisible.
//  - `data-scrolled` suit le défilement de la page : ombre de la barre du haut,
//    et sur téléphone bascule vers la rangée d'icônes. Le seuil de 60 px évite
//    que la barre change d'état au moindre frôlement.
const SCROLL_EFFECTS = `(function(){try{var r=document.documentElement;if(!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)){r.classList.add('js-reveal')}var t=function(){r.setAttribute('data-scrolled',(window.scrollY>60)?'true':'false')};t();addEventListener('scroll',t,{passive:true})}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // Le script de tête ajoute `js-reveal` et `data-scrolled` sur <html> avant
    // l'hydratation : l'écart avec le HTML du serveur est voulu, pas un bug.
    <html lang="fr" className={`${inter.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: CHUNK_RECOVERY }} />
        <script dangerouslySetInnerHTML={{ __html: SCROLL_EFFECTS }} />
      </head>
      <body>
        <RevealObserver />
        {children}
      </body>
    </html>
  );
}
