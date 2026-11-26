// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appVersion } from '../lib/appVersion';
import {
  AWAY_MS,
  CHECK_EVERY_MS,
  fetchLiveVersion,
  hasUnsentText,
  reloadInPlace,
  RETURN_MS,
  startQuietUpdates,
} from '../lib/quietUpdate';

type Listener = (navigation: { pathChanged: boolean; toLocation: { href: string } }) => void;

let live: string | null;
let listener: Listener;
let visibility: DocumentVisibilityState;
let stop: () => void;
const load = vi.fn();
const stored = new Map<string, string>();
const store = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => void stored.set(key, value),
};

const start = (installed = false, liveVersion = async () => live) => {
  stop = startQuietUpdates({
    current: 'v1',
    liveVersion,
    onNavigate: (next) => {
      listener = next;
      return () => {};
    },
    load,
    store,
    installed,
  });
};
const settle = () => vi.advanceTimersByTimeAsync(0);
const setVisibility = async (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
  await settle();
};
const moveTo = (href: string, pathChanged = true) =>
  listener({ pathChanged, toLocation: { href } });

beforeEach(() => {
  vi.useFakeTimers();
  live = 'v1';
  visibility = 'visible';
  stored.clear();
  load.mockReset();
  document.body.innerHTML = '';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});
afterEach(() => {
  stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('quiet update (owner, 26 Oct 2026)', () => {
  it('does nothing while the same version is live', async () => {
    start();
    await settle();
    moveTo('/mails');
    await setVisibility('hidden');
    expect(load).not.toHaveBeenCalled();
  });

  it('opens the next page as a full load once a new version is live', async () => {
    start();
    live = 'v2';
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(load).not.toHaveBeenCalled();
    moveTo('/mails?request=open', false);
    expect(load).not.toHaveBeenCalled();
    moveTo('/applications');
    expect(load).toHaveBeenCalledExactlyOnceWith('/applications');
  });

  it('reloads while the tab is in the background, and checks when it comes back', async () => {
    start();
    await settle();
    live = 'v2';
    await setVisibility('hidden');
    expect(load).not.toHaveBeenCalled();
    await setVisibility('visible');
    expect(load).not.toHaveBeenCalled();
    await setVisibility('hidden');
    expect(load).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('reloads at once when the new version is found while the tab is hidden', async () => {
    visibility = 'hidden';
    live = 'v2';
    start();
    await settle();
    expect(load).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('waits while something typed is not sent', async () => {
    document.body.innerHTML = '<textarea></textarea>';
    const box = document.querySelector('textarea')!;
    box.value = 'Hi Priya, Tuesday works';
    live = 'v2';
    start();
    await settle();
    moveTo('/applications');
    await setVisibility('hidden');
    expect(load).not.toHaveBeenCalled();
    box.value = '';
    moveTo('/mails');
    expect(load).toHaveBeenCalledExactlyOnceWith('/mails');
  });

  it('reloads only once for a version, so an old cached page cannot loop', async () => {
    live = 'v2';
    start();
    await settle();
    moveTo('/mails');
    stop();
    // After the reload the page still runs v1 (a cache served old files).
    start();
    await settle();
    moveTo('/applications');
    await setVisibility('hidden');
    expect(load).toHaveBeenCalledTimes(1);
    // A later version is taken again.
    live = 'v3';
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('ignores a version file it cannot read', async () => {
    live = null;
    start();
    await settle();
    moveTo('/mails');
    expect(load).not.toHaveBeenCalled();
  });
});

describe('quiet update in the installed app', () => {
  const away = async (ms: number) => {
    await setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(ms);
    await setVisibility('visible');
  };

  it('never reloads on a page move, nor when the app goes to the background', async () => {
    live = 'v2';
    start(true);
    await settle();
    moveTo('/applications');
    await setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(CHECK_EVERY_MS);
    expect(load).not.toHaveBeenCalled();
  });

  it('keeps the place after a short time away', async () => {
    live = 'v2';
    start(true);
    await settle();
    await away(AWAY_MS - 1000);
    expect(load).not.toHaveBeenCalled();
  });

  it('takes the new version when it comes back after a long time away', async () => {
    live = 'v2';
    start(true);
    await settle();
    await away(AWAY_MS);
    expect(load).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('takes a version it only learns of on coming back, in the first moments', async () => {
    let answer: (version: string) => void = () => {};
    start(true, () => new Promise<string | null>((resolve) => (answer = resolve)));
    answer('v1');
    await away(AWAY_MS);
    await vi.advanceTimersByTimeAsync(RETURN_MS - 1000);
    answer('v2');
    await settle();
    expect(load).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('leaves the app alone once it is touched', async () => {
    let answer: (version: string) => void = () => {};
    start(true, () => new Promise<string | null>((resolve) => (answer = resolve)));
    answer('v1');
    await away(AWAY_MS);
    document.dispatchEvent(new Event('pointerdown'));
    answer('v2');
    await settle();
    expect(load).not.toHaveBeenCalled();
  });

  it('leaves the app alone when the answer comes late, until the next long time away', async () => {
    let answer: (version: string) => void = () => {};
    start(true, () => new Promise<string | null>((resolve) => (answer = resolve)));
    answer('v1');
    await away(AWAY_MS);
    await vi.advanceTimersByTimeAsync(RETURN_MS);
    answer('v2');
    await settle();
    moveTo('/mails');
    expect(load).not.toHaveBeenCalled();
    await away(AWAY_MS);
    expect(load).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('waits while something typed is not sent', async () => {
    document.body.innerHTML = '<textarea></textarea>';
    document.querySelector('textarea')!.value = 'Hi Priya, Tuesday works';
    live = 'v2';
    start(true);
    await settle();
    await away(AWAY_MS);
    expect(load).not.toHaveBeenCalled();
  });
});

describe('the pieces', () => {
  it('loads a page in place, so the history gets no new step', () => {
    const at = { pathname: '/mails', search: '?request=open', hash: '' };
    const reload = vi.fn();
    const replace = vi.fn();
    // The router has already put the next address in place: load it again where it is.
    reloadInPlace('/mails?request=open', { ...at, reload, replace });
    reloadInPlace(null, { ...at, reload, replace });
    expect(reload).toHaveBeenCalledTimes(2);
    expect(replace).not.toHaveBeenCalled();
    reloadInPlace('/applications', { ...at, reload, replace });
    expect(replace).toHaveBeenCalledExactlyOnceWith('/applications');
  });

  it('reads the version the build wrote into the page, and is "dev" without one', () => {
    expect(appVersion()).toBe('dev');
    document.head.innerHTML = '<meta name="app-version" content="d470b8a61ed98b37">';
    expect(appVersion()).toBe('d470b8a61ed98b37');
    document.head.innerHTML = '';
  });

  it('reads the live version without the cache, and null when it cannot', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: 'abc123' })))
      .mockResolvedValueOnce(new Response('Not found', { status: 404 }))
      .mockRejectedValueOnce(new Error('offline'));
    expect(await fetchLiveVersion()).toBe('abc123');
    expect(fetch.mock.calls[0][1]).toEqual({ cache: 'no-store' });
    expect(fetch.mock.calls[0][0]).toMatch(/^\/version\.json\?t=\d+$/);
    expect(await fetchLiveVersion()).toBeNull();
    expect(await fetchLiveVersion()).toBeNull();
  });

  it('counts text boxes and editors with text, not empty or read-only ones', () => {
    document.body.innerHTML =
      '<input type="text"><input type="checkbox" value="on"><input readonly value="x"><div contenteditable="true"> </div>';
    expect(hasUnsentText()).toBe(false);
    document.querySelector<HTMLElement>('[contenteditable]')!.textContent = 'Draft';
    expect(hasUnsentText()).toBe(true);
  });
});
