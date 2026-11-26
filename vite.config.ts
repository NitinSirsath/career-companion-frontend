import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { readFileSync } from 'node:fs'
import path from 'path'
import { filesIn, fingerprint, writeVersion, type NamedFile } from './scripts/app-version.ts'

const publicDir = path.resolve(import.meta.dirname, 'public')

/**
 * Gives each build its version (`scripts/app-version.ts`): a fingerprint of the page, the files it
 * loads and everything in `public/`. It writes it into the page and into `version.json`.
 */
function versionFile(): Plugin {
  let version = ''
  return {
    name: 'version-file',
    apply: 'build',
    // After the page is written, so `version.json` gets the version worked out for it.
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle = {} }) {
        const built = Object.values(bundle).map(
          (file): NamedFile => [file.fileName, file.type === 'chunk' ? file.code : file.source],
        )
        const kept = filesIn(publicDir).map(
          (name): NamedFile => [`public/${name}`, readFileSync(path.join(publicDir, name))],
        )
        version = fingerprint([['index.html', html], ...built, ...kept])
        return writeVersion(html, version)
      },
    },
    generateBundle() {
      if (!version) this.error('The page was not written before version.json: no version to give it.')
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) })
    },
  }
}

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
    versionFile(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      // MCP endpoint (ADR-0002), so the URL shown on the Automation page works in development.
      '/mcp': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    }
  }
})
