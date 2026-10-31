/**
 * NorthList's service worker (owner, 30 Oct 2026). It has two jobs and no more:
 *
 * 1. Keep the app's own files, so pages already seen open offline. The page itself and
 *    `version.json` always come from the network while online, so the quiet update still sees a
 *    new version. It keeps no API answers: the app keeps its own copies of the data.
 * 2. Show push alerts, and open the alert's page on a tap.
 *
 * Plain JavaScript, served as it is from `public/`. The tests run it with stand-ins for the
 * browser parts (`src/tests/service-worker.test.ts`).
 */

/** The page every app address loads (the same index.html). */
const PAGE_CACHE = 'northlist-page-v1';
/** The build's hashed files. Their name changes whenever their content does. */
const FILE_CACHE = 'northlist-files-v1';
const PAGE_KEY = '/';

/** A file name with an extension: not an app page (`/privacy.html`, `/version.json`, icons). */
const FILE_NAME = /\.[a-z0-9]+$/i;
const HASHED_FILE = /^\/assets\//;

/** The hashed files an index.html names, such as `/assets/index-a1b2c3.js`. */
function filesNamedIn(html) {
  return [...new Set(html.match(/\/assets\/[^"'\s)]+/g) || [])];
}

/** The parts a script loads later, such as the reply box: `./RichReplyField-a1b2c3.js`. */
function partsNamedIn(script) {
  return (script.match(/\.\/[\w-]+\.js/g) || []).map((part) => `/assets/${part.slice(2)}`);
}

/**
 * Lookups ignore `Vary`: a server may vary a file on `Origin`, and a script loaded by the page
 * (with an origin) must still find the copy kept here (without one).
 */
const ANY = { ignoreVary: true };

/** A file that cannot be fetched now is fetched and kept on first use instead. */
async function keepFile(kept, file) {
  if (!(await kept.match(file, ANY))) await kept.add(file).catch(() => undefined);
}

/**
 * Keeps the page and every file it needs, the parts its scripts load later among them (the reply
 * box), and drops kept files it no longer uses. Runs on full page loads only, which are rare in
 * this app; files already kept are not fetched again.
 */
async function keepPage(response) {
  const html = await response.clone().text();
  await (await caches.open(PAGE_CACHE)).put(PAGE_KEY, response);
  const kept = await caches.open(FILE_CACHE);
  const wanted = filesNamedIn(html);
  for (let i = 0; i < wanted.length; i++) {
    await keepFile(kept, wanted[i]);
    const script = wanted[i].endsWith('.js') && (await kept.match(wanted[i], ANY));
    if (!script) continue;
    for (const part of partsNamedIn(await script.text()))
      if (!wanted.includes(part)) wanted.push(part);
  }
  for (const request of await kept.keys()) {
    if (!wanted.includes(new URL(request.url).pathname)) await kept.delete(request);
  }
}

/** Network first: the newest page while online, the kept one offline. */
async function page(event) {
  try {
    const response = await fetch(event.request);
    const type = response.headers.get('content-type') || '';
    if (response.ok && type.includes('text/html')) event.waitUntil(keepPage(response.clone()));
    return response;
  } catch (error) {
    const kept = await caches.match(PAGE_KEY, { ...ANY, cacheName: PAGE_CACHE });
    if (kept) return kept;
    throw error;
  }
}

/** Kept first: a hashed file never changes under the same name. */
async function file(event) {
  const kept = await caches.match(event.request, { ...ANY, cacheName: FILE_CACHE });
  if (kept) return kept;
  const response = await fetch(event.request);
  if (response.ok) {
    const copy = response.clone();
    event.waitUntil(caches.open(FILE_CACHE).then((cache) => cache.put(event.request, copy)));
  }
  return response;
}

self.addEventListener('install', (event) => {
  // Nothing old to wait for: the page always comes from the network while online.
  self.skipWaiting();
  event.waitUntil(
    fetch(PAGE_KEY, { cache: 'no-store' })
      .then((response) => (response.ok ? keepPage(response) : undefined))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('northlist-') && name !== PAGE_CACHE && name !== FILE_CACHE)
          await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && !FILE_NAME.test(url.pathname)) {
    event.respondWith(page(event));
    return;
  }
  if (HASHED_FILE.test(url.pathname)) event.respondWith(file(event));
  // Everything else, the API and version.json among it, goes to the network as usual.
});

/** The alert the server sent: its title, text, the page to open (a path) and its tag. */
function alertFrom(data) {
  let message = {};
  try {
    message = (data && data.json()) || {};
  } catch {
    message = {};
  }
  const text = (value) => (typeof value === 'string' && value ? value : undefined);
  const url = text(message.url) || '/';
  return {
    title: text(message.title) || 'NorthList',
    body: text(message.body) || '',
    // Only a path on this site: an alert never opens another site.
    url: url.startsWith('/') && !url.startsWith('//') ? url : '/',
    tag: text(message.tag),
  };
}

self.addEventListener('push', (event) => {
  const alert = alertFrom(event.data);
  event.waitUntil(
    self.registration.showNotification(alert.title, {
      body: alert.body,
      tag: alert.tag,
      icon: '/icon-192.png',
      badge: '/alert-badge.png',
      data: { url: alert.url },
    }),
  );
});

/** Shows the page in an open NorthList window, or opens one. */
async function openPage(path) {
  const url = new URL(path, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
  if (open) {
    try {
      await open.focus();
      await open.navigate(url);
      return;
    } catch {
      // A window this worker does not control cannot be moved: open the page in a new one.
    }
  }
  await self.clients.openWindow(url);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data;
  event.waitUntil(openPage(data && typeof data.url === 'string' ? data.url : '/'));
});
