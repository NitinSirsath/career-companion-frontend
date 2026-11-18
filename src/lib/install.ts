/**
 * "Install NorthList" (owner, 18 Nov 2026, approved mock `INSTALL-PROMPT-mock/`). The app is
 * installable (manifest and service worker); this asks people to install it.
 * - Chrome, Edge and Android offer an install box: the browser's `beforeinstallprompt` event is
 *   kept, and Install opens it.
 * - iPhone and iPad have no install box for sites: the card shows the Share steps instead.
 * - Elsewhere (Firefox on a computer), or inside the installed app: nothing.
 * The card waits 20 seconds after the app opens. Not now or Got it hides it for 30 days; an
 * install hides it for good. Kept in this browser only.
 */
import { useSyncExternalStore } from 'react';
import { isAppleMobile, isInstalledApp } from './alerts';

/** What this browser can do: open the install box, show the iPhone steps, or nothing. */
export type InstallKind = 'prompt' | 'ios' | null;

/** The part of Chrome's `beforeinstallprompt` event used here. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const INSTALL_CARD_DELAY_MS = 20_000;
export const NOT_NOW_DAYS = 30;
const DAY_MS = 86_400_000;
const STORE_KEY = 'northlist.install';

interface Remembered {
  /** The card stays away until this time (ms). */
  hiddenUntil?: number;
  /** Installed from here: the card and the menu item never show again in this browser. */
  installed?: boolean;
}

let offer: InstallPromptEvent | null = null;
/** "Install app" asked for the card now, also within the 30 days. */
let opened = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());

function remembered(): Remembered {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Remembered;
  } catch {
    return {};
  }
}

function remember(value: Remembered) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    // Private mode: the card simply asks again next time.
  }
  changed();
}

/** Listens for the browser's install offer and for an install; call once, before the app draws. */
export function startInstallWatch(target: Window = window) {
  target.addEventListener('beforeinstallprompt', (event) => {
    // Our card asks instead of the browser's own small bar.
    event.preventDefault();
    offer = event as InstallPromptEvent;
    changed();
  });
  target.addEventListener('appinstalled', () => {
    offer = null;
    opened = false;
    remember({ installed: true });
  });
}

/** What this browser can do now; null inside the installed app or once installed from here. */
export function installKind(): InstallKind {
  const b = { navigator, window };
  if (isInstalledApp(b) || remembered().installed) return null;
  if (offer) return 'prompt';
  return isAppleMobile(b) ? 'ios' : null;
}

/** True when the card may show at `now` (after its delay, which the caller times). */
export function cardAllowed(now = Date.now()): boolean {
  if (opened) return true;
  const { hiddenUntil } = remembered();
  return hiddenUntil === undefined || now >= hiddenUntil;
}

/** Not now, Got it, or a closed install box: away for 30 days. */
export function hideForNow(now = Date.now()) {
  opened = false;
  remember({ ...remembered(), hiddenUntil: now + NOT_NOW_DAYS * DAY_MS });
}

/** Opens the browser's install box; true when the person installed. */
export async function installNow(now = Date.now()): Promise<boolean> {
  const event = offer;
  if (!event) return false;
  await event.prompt();
  const { outcome } = await event.userChoice;
  // The browser gives each offer once; a new one comes if it may ask again.
  offer = null;
  if (outcome === 'accepted') {
    opened = false;
    remember({ installed: true });
    return true;
  }
  hideForNow(now);
  return false;
}

/**
 * "Install app" in the menu: the install box where there is one, else the card with the iPhone
 * steps, at once.
 */
export function openInstall() {
  if (offer) {
    void installNow();
    return;
  }
  opened = true;
  changed();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** What the card and the menu need: the kind, and whether "Install app" asked for the card. */
export function useInstall() {
  const kind = useSyncExternalStore(subscribe, installKind, () => null);
  const forced = useSyncExternalStore(
    subscribe,
    () => opened,
    () => false,
  );
  return { kind, forced };
}

/** For tests: forget the offer and the menu's request. */
export function resetInstallForTests() {
  offer = null;
  opened = false;
  changed();
}
