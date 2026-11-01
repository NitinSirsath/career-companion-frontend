import { copyFileSync } from 'fs';
import path from 'path';
import { defineConfig, type Connect, type Plugin } from 'vite';
import { fillParts } from './site/parts/index.ts';

/**
 * The product site on northlist.site (owner, 31 Oct and 1 Nov 2026): `npm run build:site` writes it to
 * `dist-site`. Five plain pages, each with its words in its HTML: the shared parts (header, footer,
 * data promises, icons) are filled in here. It also holds `site/public` (privacy policy, page not found,
 * Google's file, `sw.js`) and the icons and link-preview image it shares with the app. No server calls,
 * no service worker of its own and no web manifest.
 */
const SHARED_FILES = ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'og-image.png'];
const root = path.resolve(import.meta.dirname, 'site');
const outDir = path.resolve(import.meta.dirname, 'dist-site');
const PAGES = ['index', 'pricing/index', 'privacy/index', 'changelog/index', 'about/index'];

const sharedFiles: Plugin = {
  name: 'shared-files',
  apply: 'build',
  closeBundle() {
    for (const file of SHARED_FILES)
      copyFileSync(path.resolve(import.meta.dirname, 'public', file), path.join(outDir, file));
  },
};

/** Render serves `pricing/index.html` at `/pricing` as well as `/pricing/`; the local servers do the same. */
const cleanAddresses: Connect.NextHandleFunction = (req, _res, next) => {
  const [address, query] = (req.url ?? '').split('?');
  if (PAGES.includes(`${address.slice(1)}/index`)) req.url = `${address}/${query ? `?${query}` : ''}`;
  next();
};

const siteParts: Plugin = {
  name: 'site-parts',
  transformIndexHtml: { order: 'pre', handler: fillParts },
  configureServer: (server) => void server.middlewares.use(cleanAddresses),
  configurePreviewServer: (server) => void server.middlewares.use(cleanAddresses),
};

export default defineConfig({
  root,
  appType: 'mpa',
  plugins: [siteParts, sharedFiles],
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: { input: PAGES.map((page) => path.join(root, `${page}.html`)) },
  },
});
