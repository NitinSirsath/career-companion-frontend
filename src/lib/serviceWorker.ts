/**
 * Starts the service worker (`public/sw.js`): it keeps the app's files so pages already seen open
 * offline, and it shows push alerts (owner, 30 Oct 2026). Production only, like the quiet update:
 * in local dev mode the files change all the time and nothing should be kept.
 */
export function startServiceWorker(nav: Navigator = navigator) {
  if (!('serviceWorker' in nav)) return;
  // A browser that refuses (a private window, a blocked site) simply has no offline pages.
  void nav.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
}
