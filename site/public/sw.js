/**
 * Removes the app's old service worker from northlist.site (owner, 31 Oct 2026).
 *
 * Until 31 Oct 2026 the app ran on northlist.site and installed a service worker there. The app
 * now runs on app.northlist.site, and northlist.site is the product site, which never registers a
 * service worker. Browsers still check `/sw.js` for the old one: they get this file, which takes
 * over, deletes the caches it can see and unregisters itself. Pages already open keep working;
 * the next visit loads straight from the network.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) await caches.delete(name);
      await self.registration.unregister();
    })(),
  );
});
