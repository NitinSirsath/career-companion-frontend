/**
 * The version this page was built as. The build writes it into the page (`vite.config.ts`): a
 * fingerprint of the app's own files, so it changes only when one of them does. A merge that
 * touches only the product site or the tests leaves it as it was, and no open or installed app
 * reloads for it. Local dev mode and tests have none and are "dev".
 */
export function appVersion(doc: Document = document): string {
  return doc.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content || 'dev';
}
