// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watchMissingParts } from '../lib/missingPart';

const indexHtml = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
/** The safety net as `index.html` runs it, before and without the app's code. */
const GUARD = indexHtml.match(/<script id="startup-guard">([\s\S]*?)<\/script>/)![1];

let reload: ReturnType<typeof vi.fn>;
let online: boolean;
let visibility: DocumentVisibilityState;
let listening: (() => void)[];

/**
 * Opens the page: an empty `#root`, and the guard running with a stand-in for the address bar.
 * What it listens for on the window is taken off after each test, as a real page load would.
 */
function openPage() {
  document.body.innerHTML = '<div id="root"></div>';
  const listen = (type: string, heard: EventListener, capture?: boolean) => {
    window.addEventListener(type, heard, capture);
    listening.push(() => window.removeEventListener(type, heard, capture));
  };
  new Function('location', 'navigator', 'window', GUARD)(
    { reload },
    { onLine: online },
    { addEventListener: listen },
  );
}
const drawApp = () => document.getElementById('root')!.append(document.createElement('main'));
const seconds = (n: number) => vi.advanceTimersByTime(n * 1000);

beforeEach(() => {
  vi.useFakeTimers();
  reload = vi.fn();
  online = true;
  visibility = 'visible';
  listening = [];
  sessionStorage.clear();
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
});
afterEach(() => {
  listening.forEach((stop) => stop());
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('the start-up safety net in index.html', () => {
  it('leaves a page alone once the app has drawn', () => {
    openPage();
    seconds(3);
    drawApp();
    seconds(60);
    expect(reload).not.toHaveBeenCalled();
  });

  it('loads the page once more when nothing is drawn after 10 seconds', () => {
    openPage();
    seconds(9);
    expect(reload).not.toHaveBeenCalled();
    seconds(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('never tries a second time, so it cannot loop', () => {
    openPage();
    seconds(10);
    // The page it loaded again draws nothing either.
    openPage();
    seconds(60);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('tries again another day, after a start that worked', () => {
    openPage();
    seconds(10);
    openPage();
    drawApp();
    seconds(10);
    openPage();
    seconds(10);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('does nothing offline, where loading again cannot help', () => {
    online = false;
    openPage();
    seconds(60);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not count time in the background', () => {
    visibility = 'hidden';
    openPage();
    seconds(60);
    expect(reload).not.toHaveBeenCalled();
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    seconds(9);
    expect(reload).not.toHaveBeenCalled();
    seconds(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not wait when the app's own script cannot be loaded", () => {
    openPage();
    const script = document.createElement('script');
    script.type = 'module';
    document.body.append(script);
    script.dispatchEvent(new Event('error'));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing when it cannot remember the try', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private mode');
    });
    openPage();
    seconds(60);
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('a part of the app that fails to load later', () => {
  const stored = new Map<string, string>();
  const store = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
  };
  const load = vi.fn();
  const missing = () => window.dispatchEvent(new Event('vite:preloadError'));
  let stop = () => {};

  beforeEach(() => {
    stored.clear();
    load.mockReset();
  });
  afterEach(() => stop());

  it('loads the page again once for a version, and again for the next', () => {
    stop = watchMissingParts({ current: 'v1', load, store });
    missing();
    missing();
    expect(load).toHaveBeenCalledTimes(1);
    stop();
    stop = watchMissingParts({ current: 'v2', load, store });
    missing();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('waits while something typed is not sent', () => {
    document.body.innerHTML = '<textarea></textarea>';
    document.querySelector('textarea')!.value = 'Hi Priya, Tuesday works';
    stop = watchMissingParts({ current: 'v1', load, store });
    missing();
    expect(load).not.toHaveBeenCalled();
  });
});
