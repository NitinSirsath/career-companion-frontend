// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';

vi.mock('../api/alerts', async () => {
  const { useQuery } = await import('@tanstack/react-query');
  const getAlertKey = vi.fn();
  return {
    getAlertKey,
    turnOnAlerts: vi.fn(),
    turnOffAlerts: vi.fn(),
    useAlertKey: () => useQuery({ queryKey: ['alerts', 'key'], queryFn: () => getAlertKey() }),
  };
});
// The real browser parts, wrapped so a test can give one its own answer.
vi.mock('../lib/alerts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../lib/alerts')>();
  return {
    ...real,
    alertState: vi.fn(real.alertState),
    turnOnHere: vi.fn(real.turnOnHere),
    turnOffHere: vi.fn(real.turnOffHere),
  };
});
vi.mock('../components/ui/toast', () => ({ showToast: vi.fn() }));

import { getAlertKey, turnOffAlerts, turnOnAlerts } from '../api/alerts';
import { ApiError } from '../api/client';
import { AlertsSection } from '../components/auth/AlertsSection';
import { logOutAndLeave } from '../components/layout/AccountMenu';
import { showToast } from '../components/ui/toast';
import { alertState, keyBytes, turnOffHere, turnOnHere, type AlertBrowser } from '../lib/alerts';
import { OFFLINE_CHANGE } from '../lib/offline';

/** A real P-256 public key, as the server gives it (base64url, no padding). */
const KEY =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const OTHER_KEY =
  'BOtHeRkEyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';
const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/150.0 Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Version/19.0 Mobile Safari/604.1';

/** A push address as the browser makes it. */
function subscription(key = KEY) {
  return {
    endpoint: ENDPOINT,
    options: { applicationServerKey: keyBytes(key).buffer },
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p256', auth: 'secret' } }),
    unsubscribe: vi.fn(async () => true),
  };
}

/** Stands in for the browser: the user agent, permission, the service worker and its push part. */
function fakeBrowser({
  agent = CHROME,
  permission = 'default' as NotificationPermission,
  answer = 'granted' as NotificationPermission,
  installed = false,
  push = true,
  worker = true,
  existing = null as ReturnType<typeof subscription> | null,
} = {}) {
  const made = subscription();
  const pushManager = {
    getSubscription: vi.fn(async () => existing),
    subscribe: vi.fn(async () => made),
  };
  const browser = {
    navigator: {
      userAgent: agent,
      maxTouchPoints: 0,
      standalone: installed,
      serviceWorker: { getRegistration: vi.fn(async () => (worker ? { pushManager } : undefined)) },
    },
    window: {
      matchMedia: () => ({ matches: installed }),
      Notification: { permission, requestPermission: vi.fn(async () => answer) },
      ...(push ? { PushManager: {} } : {}),
    },
  } as unknown as AlertBrowser;
  return { browser, pushManager, made };
}

beforeEach(() => {
  vi.mocked(turnOnAlerts).mockReset();
  vi.mocked(turnOffAlerts).mockReset();
  vi.mocked(showToast).mockClear();
  // Back to the real browser parts.
  vi.mocked(alertState).mockReset();
  vi.mocked(turnOnHere).mockReset();
  vi.mocked(turnOffHere).mockReset();
});
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe('what the Account page shows for this device', () => {
  it('turns the server key into the bytes the browser wants', () => {
    expect(keyBytes(KEY)).toHaveLength(65);
    expect(keyBytes(KEY)[0]).toBe(4);
  });

  it('asks iPhone users to add the app to the Home Screen first', async () => {
    expect(await alertState(KEY, fakeBrowser({ agent: IPHONE }).browser)).toBe('home-screen-first');
    expect(await alertState(KEY, fakeBrowser({ agent: IPHONE, installed: true }).browser)).toBe(
      'off',
    );
  });

  it('knows a browser without alerts, a blocked one, and one without the service worker', async () => {
    expect(await alertState(KEY, fakeBrowser({ push: false }).browser)).toBe('unsupported');
    expect(await alertState(KEY, fakeBrowser({ permission: 'denied' }).browser)).toBe('blocked');
    expect(await alertState(KEY, fakeBrowser({ worker: false }).browser)).toBe('unsupported');
  });

  it('is on only with permission and a push address made with the server key', async () => {
    const on = { permission: 'granted' as const, existing: subscription() };
    expect(await alertState(KEY, fakeBrowser(on).browser)).toBe('on');
    const stale = { permission: 'granted' as const, existing: subscription(OTHER_KEY) };
    expect(await alertState(KEY, fakeBrowser(stale).browser)).toBe('off');
    expect(await alertState(KEY, fakeBrowser({ permission: 'granted' }).browser)).toBe('off');
  });
});

describe('turning alerts on and off', () => {
  it('asks, makes the push address with the server key, and saves it on the server', async () => {
    vi.mocked(turnOnAlerts).mockResolvedValue({ on: true, firstAlertSent: true });
    const { browser, pushManager } = fakeBrowser();
    expect(await turnOnHere(KEY, browser)).toEqual({ state: 'on', firstAlertSent: true });
    expect(browser.window.Notification.requestPermission).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(KEY),
    });
    expect(turnOnAlerts).toHaveBeenCalledWith({
      endpoint: ENDPOINT,
      keys: { p256dh: 'p256', auth: 'secret' },
    });
  });

  it('stops when the user says no, and saves nothing', async () => {
    const { browser, pushManager } = fakeBrowser({ answer: 'denied' });
    expect(await turnOnHere(KEY, browser)).toEqual({ state: 'blocked' });
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(turnOnAlerts).not.toHaveBeenCalled();
  });

  it('drops a push address made with an old key, and one the server refused', async () => {
    const old = subscription(OTHER_KEY);
    const { browser, made } = fakeBrowser({ permission: 'granted', existing: old });
    vi.mocked(turnOnAlerts).mockRejectedValue(
      new ApiError('Gone', 'http', 409, 'ALERT_DEVICE_GONE'),
    );
    await expect(turnOnHere(KEY, browser)).rejects.toThrow('Gone');
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(made.unsubscribe).toHaveBeenCalled();
  });

  it('turns off on the server first, then in the browser', async () => {
    const existing = subscription();
    const { browser } = fakeBrowser({ permission: 'granted', existing });
    await turnOffHere(browser);
    expect(turnOffAlerts).toHaveBeenCalledWith({ endpoint: ENDPOINT });
    expect(existing.unsubscribe).toHaveBeenCalled();

    vi.mocked(turnOffAlerts).mockClear();
    await turnOffHere(fakeBrowser().browser);
    expect(turnOffAlerts).not.toHaveBeenCalled();
  });
});

describe('the Account page section', () => {
  function show() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AlertsSection />
      </QueryClientProvider>,
    );
  }

  it('is hidden while the server has no alert keys', async () => {
    vi.mocked(getAlertKey).mockResolvedValue({ available: false, publicKey: null });
    show();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText('Alerts on this device')).not.toBeInTheDocument();
  });

  it('says the browser cannot show alerts when it cannot', async () => {
    vi.mocked(getAlertKey).mockResolvedValue({ available: true, publicKey: KEY });
    show();
    expect(await screen.findByText('Alerts on this device')).toBeInTheDocument();
    expect(screen.getByText('This browser cannot show alerts.')).toBeInTheDocument();
  });

  it('turning on offline says nothing was changed', async () => {
    vi.mocked(getAlertKey).mockResolvedValue({ available: true, publicKey: KEY });
    vi.mocked(alertState).mockResolvedValue('off');
    show();
    const button = await screen.findByRole('button', { name: 'Turn on alerts' });
    onlineManager.setOnline(false);
    fireEvent.click(button);
    expect(showToast).toHaveBeenCalledWith(OFFLINE_CHANGE, { offline: true });
    expect(turnOnHere).not.toHaveBeenCalled();
  });

  it('turns on, says the first alert came, and offers to turn off', async () => {
    vi.mocked(getAlertKey).mockResolvedValue({ available: true, publicKey: KEY });
    vi.mocked(alertState).mockResolvedValue('off');
    vi.mocked(turnOnHere).mockResolvedValue({ state: 'on', firstAlertSent: true });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }));
    expect(
      await screen.findByText(/On for this device\. You got a first alert to show it works\./),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turn off' })).toBeInTheDocument();
  });

  it('says why it could not turn on', async () => {
    vi.mocked(getAlertKey).mockResolvedValue({ available: true, publicKey: KEY });
    vi.mocked(alertState).mockResolvedValue('off');
    vi.mocked(turnOnHere).mockRejectedValue(
      new ApiError('This device did not accept alerts. Try again.', 'http', 409),
    );
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on alerts' }));
    expect(
      await screen.findByText('This device did not accept alerts. Try again.'),
    ).toBeInTheDocument();
  });
});

describe('signing out', () => {
  it('turns alerts off on this device first', async () => {
    vi.mocked(turnOffHere).mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}')),
    );
    const leave = vi.spyOn(window, 'location', 'get').mockReturnValue({ href: '' } as Location);
    await logOutAndLeave();
    expect(turnOffHere).toHaveBeenCalled();
    leave.mockRestore();
    vi.unstubAllGlobals();
  });
});
