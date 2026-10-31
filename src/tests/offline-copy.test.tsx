// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  dehydrate,
  onlineManager,
  useQueryClient,
} from '@tanstack/react-query';
import { SignInGate } from '../components/startup/SignInGate';
import {
  KEEP_FOR_MS,
  keepCopies,
  readCopy,
  restoreCopy,
  type CopyStore,
  type SavedCopy,
} from '../lib/offlineCopy';

const ME = { id: 'u1', email: 'me@test.local', name: 'Me' };
const OTHER = { id: 'u2', email: 'other@test.local', name: 'Other' };
const LIST_KEY = ['conversations', 'list', {}, 0];
const NOW = new Date('2026-10-30T10:42:00Z').getTime();

/** A store in memory, with every call counted. */
function memoryStore(saved: unknown = undefined) {
  let value = saved;
  return {
    get: vi.fn(async () => value),
    set: vi.fn(async (copy: SavedCopy) => void (value = copy)),
    clear: vi.fn(async () => void (value = undefined)),
    current: () => value as SavedCopy | undefined,
  } satisfies CopyStore & { current: () => SavedCopy | undefined };
}

/** A copy of one conversation list, saved by `user` for app version v1. */
function savedCopy(user = ME, savedAt = NOW, dataUpdatedAt = NOW): SavedCopy {
  const client = new QueryClient();
  client.setQueryData(LIST_KEY, { items: ['Acme'] }, { updatedAt: dataUpdatedAt });
  return { version: 'v1', user, savedAt, state: dehydrate(client) };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe('reading the saved copy', () => {
  it('gives the copy saved by this app version within 7 days', async () => {
    const copy = savedCopy();
    expect(await readCopy(memoryStore(copy), 'v1', NOW + KEEP_FOR_MS)).toEqual(copy);
  });

  it('drops a copy that is too old, or was saved by another version', async () => {
    for (const [copy, version, now] of [
      [savedCopy(), 'v1', NOW + KEEP_FOR_MS + 1],
      [savedCopy(), 'v2', NOW],
      [{ nonsense: true }, 'v1', NOW],
    ] as const) {
      const store = memoryStore(copy);
      expect(await readCopy(store, version, now)).toBeNull();
      expect(store.clear).toHaveBeenCalled();
    }
  });

  it('counts a store that fails as no copy', async () => {
    const store = memoryStore();
    store.get.mockRejectedValue(new Error('no IndexedDB here'));
    expect(await readCopy(store, 'v1')).toBeNull();
  });

  it('puts the data back, leaving out anything older than 7 days', () => {
    const client = new QueryClient();
    restoreCopy(client, savedCopy(), NOW + 1000);
    expect(client.getQueryData(LIST_KEY)).toEqual({ items: ['Acme'] });

    const old = new QueryClient();
    restoreCopy(old, savedCopy(ME, NOW, NOW - KEEP_FOR_MS - 1), NOW);
    expect(old.getQueryData(LIST_KEY)).toBeUndefined();
  });
});

describe('saving the copy', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));

  it('saves the kept data a second after new data arrives, once', async () => {
    const client = new QueryClient();
    const store = memoryStore();
    const stop = keepCopies(client, ME, store, 'v1');
    client.setQueryData(LIST_KEY, { items: ['Acme'] });
    client.setQueryData(['application', 'a7'], { company: 'Acme' });
    await vi.advanceTimersByTimeAsync(999);
    expect(store.set).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(store.set).toHaveBeenCalledTimes(1);
    const copy = store.current()!;
    expect(copy).toMatchObject({ version: 'v1', user: ME, savedAt: NOW + 1000 });
    expect(copy.state.queries.map((query) => query.queryKey)).toEqual([
      LIST_KEY,
      ['application', 'a7'],
    ]);
    stop();
  });

  it('keeps only the pages kept for offline, and saves nothing offline or once stopped', async () => {
    const client = new QueryClient();
    const store = memoryStore();
    const stop = keepCopies(client, ME, store, 'v1');
    client.setQueryData(['integrationTokens'], { items: [] });
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.set).not.toHaveBeenCalled();

    onlineManager.setOnline(false);
    client.setQueryData(LIST_KEY, { items: ['Acme'] });
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.set).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    stop();
    client.setQueryData(LIST_KEY, { items: ['Globex'] });
    await vi.advanceTimersByTimeAsync(2000);
    expect(store.set).not.toHaveBeenCalled();
  });
});

describe('opening the app with a saved copy', () => {
  const ME_JSON = () => Promise.resolve(new Response(JSON.stringify(ME)));
  let me: () => Promise<Response>;

  beforeEach(() => {
    me = () => Promise.reject(new TypeError('Failed to fetch'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string) =>
        input === '/api/auth/me' ? me() : new Response(JSON.stringify({ mode: 'prod' })),
      ),
    );
  });

  /** The gate around a stand-in app that names its user and the first company it has data for. */
  function Page({ user }: { user: { email: string } | null }) {
    const data = useQueryClient().getQueryData<{ items: string[] }>(LIST_KEY);
    return (
      <p>
        App for {user ? user.email : 'nobody'} with {data ? data.items[0] : 'no data'}
      </p>
    );
  }
  function show(store: CopyStore, client = new QueryClient()) {
    render(
      <QueryClientProvider client={client}>
        <SignInGate store={store} version="v1">
          {(user) => <Page user={user} />}
        </SignInGate>
      </QueryClientProvider>,
    );
  }

  it('offline, opens at once for the copy user, with the copy data', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    show(memoryStore(savedCopy()));
    expect(await screen.findByText('App for me@test.local with Acme')).toBeInTheDocument();
  });

  it('offline with no copy, shows the start-up screen as before', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    show(memoryStore());
    expect(await screen.findByText("You're offline")).toBeInTheDocument();
  });

  it('online, uses the copy only for its own user', async () => {
    me = ME_JSON;
    show(memoryStore(savedCopy()));
    expect(await screen.findByText('App for me@test.local with Acme')).toBeInTheDocument();
  });

  it('drops the copy when someone else is signed in, or nobody', async () => {
    me = () => Promise.resolve(new Response(JSON.stringify(OTHER)));
    const store = memoryStore(savedCopy());
    show(store);
    expect(await screen.findByText('App for other@test.local with no data')).toBeInTheDocument();
    expect(store.clear).toHaveBeenCalled();
    cleanup();

    me = () => Promise.resolve(new Response('{}', { status: 401 }));
    const signedOut = memoryStore(savedCopy());
    show(signedOut);
    expect(await screen.findByText('App for nobody with no data')).toBeInTheDocument();
    expect(signedOut.clear).toHaveBeenCalled();
  });

  it('saves new data for the signed-in user', async () => {
    me = ME_JSON;
    const store = memoryStore();
    const client = new QueryClient();
    show(store, client);
    await screen.findByText('App for me@test.local with no data');
    await act(async () => {
      client.setQueryData(LIST_KEY, { items: ['Globex'] });
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });
    expect(store.current()).toMatchObject({ version: 'v1', user: ME });
  });
});
