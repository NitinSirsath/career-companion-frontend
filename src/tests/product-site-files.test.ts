import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/** The product site's plain files (`site/public`), which `npm run build:site` copies as they are. */
const read = (name: string) => readFileSync(resolve(__dirname, '../../site/public', name), 'utf8');

describe('the product site\'s "page not found"', () => {
  const page = read('404.html');

  it('is a plain page: no scripts, nothing from the server', () => {
    expect(page).not.toMatch(/<script/i);
    expect(page).not.toMatch(/\/api\//);
  });

  it('leads home, to sign-in on the app site and to the privacy policy', () => {
    expect(page).toContain('<h1>Nothing here to sort.</h1>');
    expect(page).toContain('<a class="button" href="/">Go to the home page');
    expect(page).toContain('href="https://app.northlist.site/login">Sign in</a>');
    expect(page).toContain('<a href="https://app.northlist.site/">app.northlist.site</a>');
    expect(page).toContain('<a href="/privacy.html">Privacy policy</a>');
  });

  it('draws 404 from 44 lit tiles on a 19 × 7 grid', () => {
    const tiles = page.match(/<div class="tiles"[^>]*>([\s\S]*?)<\/div>/)![1];
    expect(tiles.match(/<b /g)).toHaveLength(44);
    expect(tiles.match(/<i><\/i>/g)).toHaveLength(19 * 7 - 44);
  });
});

describe("the product site's sw.js", () => {
  it('removes the old app service worker: takes over, deletes every cache, unregisters', async () => {
    const handlers: Record<string, (event: unknown) => void> = {};
    const self = {
      addEventListener: (type: string, handler: (event: unknown) => void) =>
        (handlers[type] = handler),
      skipWaiting: vi.fn(),
      registration: { unregister: vi.fn(async () => true) },
    };
    const deleted: string[] = [];
    const caches = {
      keys: async () => ['northlist-page-v1', 'northlist-files-v1'],
      delete: async (name: string) => void deleted.push(name),
    };
    new Function('self', 'caches', read('sw.js'))(self, caches);

    handlers.install({});
    expect(self.skipWaiting).toHaveBeenCalled();

    let done: Promise<unknown> = Promise.resolve();
    handlers.activate({ waitUntil: (work: Promise<unknown>) => (done = work) });
    await done;
    expect(deleted).toEqual(['northlist-page-v1', 'northlist-files-v1']);
    expect(self.registration.unregister).toHaveBeenCalled();
  });
});

describe("the product site's privacy addresses on Cloudflare Pages", () => {
  // Cloudflare serves privacy.html at /privacy, over the Privacy page; so the build ships the policy as
  // privacy-policy.html and `_redirects` serves it at its Google-approved address without a redirect.
  it('builds the policy as privacy-policy.html and serves it at /privacy.html', () => {
    const config = readFileSync(resolve(__dirname, '../../vite.site.config.ts'), 'utf8');
    expect(config).toContain(
      "renameSync(path.join(outDir, 'privacy.html'), path.join(outDir, 'privacy-policy.html'))",
    );
    expect(read('_redirects').split('\n')).toContain('/privacy.html /privacy-policy 200');
  });
});
