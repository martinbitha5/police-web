import type { MetadataRoute } from 'next';

/**
 * Manifeste de l'application web : c'est lui que le téléphone lit quand le
 * portail est ajouté à l'écran d'accueil (nom, icône, plein écran), et c'est
 * cette icône qui accompagne les notifications push sur iPhone. Sans lui, iOS
 * affiche une capture d'écran floue et une notification sans logo.
 *
 * Servi à /manifest.webmanifest par Next, exclu du middleware d'authentification
 * comme le service worker.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Police Bagage',
    short_name: 'Police Bagage',
    description: 'Supervision anti-fraude bagages et contrôle d’embarquement.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    lang: 'fr',
    icons: [
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
