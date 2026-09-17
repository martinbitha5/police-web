/*
 * Service worker du portail : réception des notifications push.
 *
 * Il ne met rien en cache et n'intercepte aucune requête : son seul rôle est
 * d'afficher la notification envoyée par la fonction edge `push-fraud-alert`
 * et d'ouvrir le tableau de bord sur le vol concerné au clic.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Police Bagage', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Police Bagage';
  const options = {
    body: data.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    requireInteraction: true,
    data: { url: data.url || '/dashboard' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Un onglet du portail déjà ouvert : on le ramène devant et on le dirige
      // vers le vol. Sinon, nouvel onglet.
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(target);
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
