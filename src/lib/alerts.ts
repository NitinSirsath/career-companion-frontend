/**
 * Push alerts on this device (owner, 30 Oct 2026): an alert when NorthList makes a new step that
 * needs the user. Each phone or computer turns alerts on by itself, from the Account page. These
 * are the browser's parts: permission, the device's push address, and the state to show.
 */
import { turnOffAlerts, turnOnAlerts } from '../api/alerts';

export type AlertState =
  /** The browser can show alerts, and they are off here. */
  | 'off'
  | 'on'
  /** The user told this browser not to show NorthList's alerts; only the browser can undo it. */
  | 'blocked'
  /** iPhone and iPad allow alerts only in the app added to the Home Screen. */
  | 'home-screen-first'
  /** This browser cannot show alerts at all. */
  | 'unsupported';

/** The browser parts used here, so tests can stand in for them. */
export interface AlertBrowser {
  navigator: Navigator;
  window: Window & typeof globalThis;
}

const browser = (): AlertBrowser => ({ navigator, window });

/** iPhone and iPad, including an iPad that names itself a Mac but has a touch screen. */
function isAppleMobile({ navigator }: AlertBrowser) {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
  );
}

/** Opened from the Home Screen (or as an installed app on a computer). */
function isInstalledApp({ navigator, window }: AlertBrowser) {
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

const canPush = ({ navigator, window }: AlertBrowser) =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** The service worker that shows the alerts; none in local dev mode or a refusing browser. */
async function worker({ navigator }: AlertBrowser) {
  return (await navigator.serviceWorker.getRegistration('/')) ?? null;
}

/** The server key as the bytes the browser wants: it comes as base64url text. */
export function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = (key + '='.repeat((4 - (key.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const text = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(text.length));
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes;
}

/** Whether a push address was made with the server's current key. Unknown counts as yes. */
function madeWithKey(key: ArrayBuffer | null, publicKey: string) {
  if (!key) return true;
  const want = keyBytes(publicKey);
  const have = new Uint8Array(key);
  return have.length === want.length && have.every((byte, i) => byte === want[i]);
}

/** This device's push address, if it has one made with the server's current key. */
async function currentSubscription(registration: ServiceWorkerRegistration, publicKey: string) {
  const subscription = await registration.pushManager.getSubscription();
  return subscription && madeWithKey(subscription.options.applicationServerKey, publicKey)
    ? subscription
    : null;
}

/** What the Account page shows for this device. */
export async function alertState(publicKey: string, b = browser()): Promise<AlertState> {
  if (isAppleMobile(b) && !isInstalledApp(b)) return 'home-screen-first';
  if (!canPush(b)) return 'unsupported';
  if (b.window.Notification.permission === 'denied') return 'blocked';
  const registration = await worker(b);
  if (!registration) return 'unsupported';
  if (b.window.Notification.permission !== 'granted') return 'off';
  return (await currentSubscription(registration, publicKey)) ? 'on' : 'off';
}

export type TurnOnResult =
  { state: 'on'; firstAlertSent: boolean } | { state: 'blocked' | 'off' | 'unsupported' };

/**
 * Turns alerts on: asks the browser (only after a tap), makes this device's push address, and
 * saves it on the server, which sends the first alert. A push address the server refused is
 * removed again, so the device and the server agree.
 */
export async function turnOnHere(publicKey: string, b = browser()): Promise<TurnOnResult> {
  const permission = await b.window.Notification.requestPermission();
  if (permission === 'denied') return { state: 'blocked' };
  if (permission !== 'granted') return { state: 'off' };
  const registration = await worker(b);
  if (!registration) return { state: 'unsupported' };
  const old = await registration.pushManager.getSubscription();
  if (old && !(await currentSubscription(registration, publicKey))) await old.unsubscribe();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  const { endpoint, keys } = subscription.toJSON();
  try {
    const answer = await turnOnAlerts({
      endpoint: endpoint ?? subscription.endpoint,
      keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' },
    });
    return { state: 'on', firstAlertSent: answer.firstAlertSent };
  } catch (error) {
    await subscription.unsubscribe().catch(() => undefined);
    throw error;
  }
}

/** Turns alerts off here: the server forgets this device, then the browser drops the address. */
export async function turnOffHere(b = browser()): Promise<void> {
  if (!canPush(b)) return;
  const registration = await worker(b);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await turnOffAlerts({ endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
