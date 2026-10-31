import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Runs `public/sw.js` with stand-ins for the browser parts it uses: the caches, the network, the
 * open windows and the alerts. Each test starts a fresh worker.
 */
const CODE = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');
const ORIGIN = 'https://northlist.test';
const PAGE = `<!doctype html><script src="/assets/index-new.js"></script><link href="/assets/index-new.css">`;

type Handler = (event: unknown) => void;

/** A stand-in for the browser's caches: named stores of URL path to response. */
function fakeCaches(network: (path: string) => Promise<Response>) {
  const stores = new Map<string, Map<string, Response>>();
  const pathOf = (key: string | Request) =>
    new URL(typeof key === 'string' ? key : key.url, ORIGIN).pathname;
  const open = async (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      match: async (key: string | Request) => store.get(pathOf(key))?.clone(),
      put: async (key: string | Request, response: Response) =>
        void store.set(pathOf(key), response),
      add: async (key: string) => void store.set(pathOf(key), await network(pathOf(key))),
      keys: async () => [...store.keys()].map((path) => new Request(ORIGIN + path)),
      delete: async (key: string | Request) => store.delete(pathOf(key)),
    };
  };
  return {
    stores,
    api: {
      open,
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
      match: async (key: string | Request, { cacheName }: { cacheName: string }) =>
        (await open(cacheName)).match(key),
    },
  };
}

let handlers: Record<string, Handler>;
let caches: ReturnType<typeof fakeCaches>;
let network: ReturnType<typeof vi.fn<(path: string) => Promise<Response>>>;
let showNotification: ReturnType<typeof vi.fn>;
let windows: { url: string; focus: ReturnType<typeof vi.fn>; navigate: ReturnType<typeof vi.fn> }[];
let openWindow: ReturnType<typeof vi.fn>;

const html = (body = PAGE) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html' } });

function startWorker() {
  handlers = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: Handler) => (handlers[type] = handler),
    skipWaiting: vi.fn(),
    registration: { showNotification },
    clients: { claim: vi.fn(), matchAll: async () => windows, openWindow },
  };
  const fetchStandIn = (input: string | Request) =>
    network(new URL(typeof input === 'string' ? input : input.url, ORIGIN).pathname);
  new Function('self', 'caches', 'fetch', CODE)(self, caches.api, fetchStandIn);
}

/** Sends a fetch event; returns what the worker answered, or undefined when it let it pass. */
async function request(path: string, mode: RequestMode | 'navigate' = 'cors', method = 'GET') {
  let answer: Promise<Response> | undefined;
  const waits: Promise<unknown>[] = [];
  handlers.fetch({
    request: { url: ORIGIN + path, method, mode },
    respondWith: (response: Promise<Response>) => (answer = response),
    waitUntil: (work: Promise<unknown>) => waits.push(work),
  });
  const response = answer && (await answer);
  await Promise.all(waits);
  return response;
}

async function run(type: string, event: object = {}) {
  const waits: Promise<unknown>[] = [];
  handlers[type]({ ...event, waitUntil: (work: Promise<unknown>) => waits.push(work) });
  await Promise.all(waits);
}

beforeEach(() => {
  network = vi.fn(async (path: string) =>
    path === '/' || !path.includes('.') ? html() : new Response(`file \${path}`),
  );
  caches = fakeCaches((path) => network(path));
  showNotification = vi.fn(async () => undefined);
  windows = [];
  openWindow = vi.fn(async () => undefined);
  startWorker();
});

describe('the app files for offline pages', () => {
  it('keeps the page and the files it names when it starts', async () => {
    await run('install');
    const page = caches.stores.get('northlist-page-v1')!;
    expect(await page.get('/')!.text()).toBe(PAGE);
    expect([...caches.stores.get('northlist-files-v1')!.keys()].sort()).toEqual([
      '/assets/index-new.css',
      '/assets/index-new.js',
    ]);
  });

  it('takes a page from the network while online, and keeps the newest one', async () => {
    const response = await request('/applications/42', 'navigate');
    expect(await response!.text()).toBe(PAGE);
    expect(network).toHaveBeenCalledWith('/applications/42');
    expect(await caches.stores.get('northlist-page-v1')!.get('/')!.text()).toBe(PAGE);
  });

  it('opens the kept page offline', async () => {
    await run('install');
    network.mockRejectedValue(new TypeError('Failed to fetch'));
    const response = await request('/mails', 'navigate');
    expect(await response!.text()).toBe(PAGE);
  });

  it('drops kept files that the newest page no longer names', async () => {
    await run('install');
    network.mockImplementation(async (path) =>
      path.includes('.')
        ? new Response(`file \${path}`)
        : html('<script src="/assets/index-v2.js">'),
    );
    await request('/dashboard', 'navigate');
    expect([...caches.stores.get('northlist-files-v1')!.keys()]).toEqual(['/assets/index-v2.js']);
  });

  it('keeps the parts a script loads later, and fetches nothing again on the next load', async () => {
    network.mockImplementation(async (path) => {
      if (path === '/assets/index-new.js')
        return new Response('lazy(() => import("./RichReplyField-r1.js"))');
      if (path.includes('.')) return new Response(`file \${path}`);
      return html();
    });
    await run('install');
    const files = () => [...caches.stores.get('northlist-files-v1')!.keys()].sort();
    expect(files()).toEqual([
      '/assets/RichReplyField-r1.js',
      '/assets/index-new.css',
      '/assets/index-new.js',
    ]);
    network.mockClear();
    await request('/mails/k1', 'navigate');
    expect(files()).toHaveLength(3);
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('serves a kept hashed file without the network, and keeps a new one on first use', async () => {
    await run('install');
    network.mockClear();
    expect(await (await request('/assets/index-new.js'))!.text()).toBe('file /assets/index-new.js');
    expect(network).not.toHaveBeenCalled();
    expect(await (await request('/assets/chunk-x.js'))!.text()).toBe('file /assets/chunk-x.js');
    expect(caches.stores.get('northlist-files-v1')!.has('/assets/chunk-x.js')).toBe(true);
  });

  it('never answers for the API, version.json, other files, other sites or changes', async () => {
    for (const [path, mode, method] of [
      ['/api/conversations', 'cors', 'GET'],
      ['/version.json?t=1', 'cors', 'GET'],
      ['/privacy.html', 'navigate', 'GET'],
      ['/icon-192.png', 'no-cors', 'GET'],
      ['/api/conversations/k/seen', 'cors', 'POST'],
    ] as const)
      expect(await request(path, mode, method)).toBeUndefined();
    let answered = false;
    handlers.fetch({
      request: { url: 'https://fonts.googleapis.com/css2', method: 'GET', mode: 'cors' },
      respondWith: () => (answered = true),
    });
    expect(answered).toBe(false);
    expect(caches.stores.has('northlist-page-v1')).toBe(false);
  });

  it('removes its own older stores when a new worker takes over, and nothing else', async () => {
    await caches.api.open('northlist-page-v0');
    await caches.api.open('someone-else');
    await run('activate');
    expect(await caches.api.keys()).toEqual(['someone-else']);
  });
});

describe('push alerts', () => {
  const push = (message: unknown) =>
    run('push', {
      data: {
        json: () => {
          if (message instanceof Error) throw message;
          return message;
        },
      },
    });

  it('shows the alert with the app icon and the small mark', async () => {
    await push({
      title: 'Acme',
      body: 'Reply with your availability',
      url: '/applications/7',
      tag: 'a1',
    });
    expect(showNotification).toHaveBeenCalledWith('Acme', {
      body: 'Reply with your availability',
      tag: 'a1',
      icon: '/icon-192.png',
      badge: '/alert-badge.png',
      data: { url: '/applications/7' },
    });
  });

  it('never opens another site, and copes with a message it cannot read', async () => {
    await push({ title: 'Acme', body: 'x', url: 'https://evil.example/' });
    await push({ title: 'Acme', body: 'x', url: '//evil.example/' });
    await push(new Error('not JSON'));
    const calls = showNotification.mock.calls;
    expect(calls[0][1].data.url).toBe('/');
    expect(calls[1][1].data.url).toBe('/');
    expect(calls[2][0]).toBe('NorthList');
    expect(calls[2][1].data.url).toBe('/');
  });

  it('a tap shows the page in an open NorthList window', async () => {
    const open = { url: `\${ORIGIN}/mails`, focus: vi.fn(), navigate: vi.fn() };
    windows = [open];
    const close = vi.fn();
    await run('notificationclick', { notification: { close, data: { url: '/applications/7' } } });
    expect(close).toHaveBeenCalled();
    expect(open.focus).toHaveBeenCalled();
    expect(open.navigate).toHaveBeenCalledWith(`\${ORIGIN}/applications/7`);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('a tap opens a new window when none is open, or when the open one cannot move', async () => {
    await run('notificationclick', { notification: { close: vi.fn(), data: { url: '/account' } } });
    expect(openWindow).toHaveBeenCalledWith(`\${ORIGIN}/account`);
    windows = [
      {
        url: `\${ORIGIN}/mails`,
        focus: vi.fn(),
        navigate: vi.fn().mockRejectedValue(new TypeError()),
      },
    ];
    await run('notificationclick', { notification: { close: vi.fn(), data: { url: '/mails' } } });
    expect(openWindow).toHaveBeenLastCalledWith(`\${ORIGIN}/mails`);
  });
});
