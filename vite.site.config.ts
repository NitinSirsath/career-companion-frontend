import { copyFileSync } from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The product site on northlist.site (owner, 31 Oct 2026): `npm run build:site` writes it to
 * `dist-site`. It holds the product page, `site/public` (privacy policy, Google's file) and the
 * icons and link-preview image it shares with the app. No service worker and no web manifest.
 */
const SHARED_FILES = ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'og-image.png'];
const outDir = path.resolve(import.meta.dirname, 'dist-site');

const sharedFiles: Plugin = {
  name: 'shared-files',
  apply: 'build',
  closeBundle() {
    for (const file of SHARED_FILES)
      copyFileSync(path.resolve(import.meta.dirname, 'public', file), path.join(outDir, file));
  },
};

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'site'),
  plugins: [react(), tailwindcss(), sharedFiles],
  build: { outDir, emptyOutDir: true },
});
