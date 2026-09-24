/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { notificationContent } from './lib/notification';
declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };
precacheAndRoute(self.__WB_MANIFEST); cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/devices\//, /^\/users\//] }));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting() });
self.addEventListener('push', event => {
let payload: Record<string, unknown> = {}; try { const parsed = event.data?.json(); if (parsed && typeof parsed === 'object') payload = parsed } catch {/* Show generic notification for malformed payload. */ }
  const { title, ...options } = notificationContent(payload);
  event.waitUntil(Promise.all([self.registration.showNotification(title, { ...options, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/' } }), self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => clients.forEach(client => client.postMessage({ type: 'SERVER_UPDATE' })))]));
});
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil((async () => { const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); const client = clients.find(c => new URL(c.url).origin === self.location.origin); if (client) { await client.focus(); client.postMessage({ type: 'SERVER_UPDATE' }); } else await self.clients.openWindow('/'); })()); });
