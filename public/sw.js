// Nestora service worker — installability + push notifications

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// iOS 16.x requires a fetch listener to be present for push subscriptions to
// work. We register the handler but do NOT call event.respondWith(), so the
// browser handles all navigations and sub-resources natively (including
// following server-side redirects correctly in the PWA).
self.addEventListener('fetch', () => {});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Nestora', {
      body: data.message ?? '',
      icon: '/icon',
      badge: '/apple-icon',
      data: { url: data.url ?? '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
