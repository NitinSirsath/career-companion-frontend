/**
 * Quiet update (owner, 26 Oct 2026): the app takes a new version by itself, with no note and
 * nothing to click. Each build writes `version.json` and puts the same id into the page
 * (`lib/appVersion.ts`). The app checks that file every 5 minutes and when it comes back into
 * view. When a new version is live, it reloads at a safe moment:
 *
 * - A browser tab: on the next move to another page (that page opens as a full load, in place),
 *   or while the tab is in the background.
 * - The installed app (opened from the Home Screen): never while it is in use and never at the
 *   moment it goes to the background, which is when a phone freezes it and a reload can leave a
 *   blank screen. It takes the new version when it is opened fresh, or when it comes back after
 *   30 minutes or more in the background, before the first touch.
 *
 * It never reloads while something typed is not sent, and it reloads at most once for a given
 * version, so a cache that still serves old files cannot make it loop.
 */

/** How often an open tab asks whether a new version is live. */
export const CHECK_EVERY_MS = 5 * 60_000;
/** The installed app reloads only after this long in the background: a short look elsewhere never costs the place. */
export const AWAY_MS = 30 * 60_000;
/** Back from that long away, it reloads only within these first moments, and not after a touch. */
export const RETURN_MS = 5_000;
/** Where this tab notes the version it already reloaded for. */
const RELOADED_FOR = 'northlist-reloaded-for';

type Navigation = { pathChanged: boolean; toLocation: { href: string } };

export type QuietUpdateDeps = {
  /** The version this page was built as. */
  current: string;
  /** The version that is live now; null when it cannot be read. */
  liveVersion: () => Promise<string | null>;
  /** Calls back before each in-app move; returns a way to stop listening. */
  onNavigate: (listener: (navigation: Navigation) => void) => () => void;
  /** Opens a page as a full load, in place (`reloadInPlace`). */
  load: (href: string | null) => void;
  /** True in the installed app (opened from the Home Screen). */
  installed?: boolean;
  doc?: Document;
  store?: Pick<Storage, 'getItem' | 'setItem'>;
};

/** Reads the live version, never from a cache. */
export async function fetchLiveVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    return typeof body.version === 'string' && body.version ? body.version : null;
  } catch {
    return null;
  }
}

/**
 * A full load that adds no history step, so Back still goes where it went. The router has already
 * put the next page's address in place when it says it is moving, so the page is loaded again
 * where it is; this also keeps what the history remembers for it. Any other address replaces
 * this one.
 */
export function reloadInPlace(
  href: string | null,
  at: Pick<Location, 'pathname' | 'search' | 'hash' | 'reload' | 'replace'> = window.location,
) {
  if (href && href !== at.pathname + at.search + at.hash) at.replace(href);
  else at.reload();
}

/** True when a text box, text area or editor on the page holds text the user has not sent. */
export function hasUnsentText(doc: Document = document): boolean {
  const fields = doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'textarea, input:not([type]), input[type="text"], input[type="email"], input[type="url"], input[type="search"]',
  );
  for (const field of fields) if (!field.readOnly && field.value.trim()) return true;
  for (const editor of doc.querySelectorAll('[contenteditable="true"]'))
    if (editor.textContent?.trim()) return true;
  return false;
}

/** Session storage when it can be used; otherwise nothing is remembered. */
function sessionStore(): QuietUpdateDeps['store'] {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

/**
 * The installed app's safe moment: just back from a long time in the background, before anyone
 * touches it. It is told when the app hides and shows, and `justBack()` says whether that moment
 * is now.
 */
function watchReturn(doc: Document) {
  let hiddenAt: number | null = doc.visibilityState === 'hidden' ? Date.now() : null;
  let until = 0;
  const inUse = () => void (until = 0);
  doc.addEventListener('pointerdown', inUse, true);
  doc.addEventListener('keydown', inUse, true);
  return {
    hidden: () => {
      hiddenAt = Date.now();
      until = 0;
    },
    shown: () => {
      if (hiddenAt !== null && Date.now() - hiddenAt >= AWAY_MS) until = Date.now() + RETURN_MS;
      hiddenAt = null;
    },
    justBack: () => doc.visibilityState === 'visible' && Date.now() < until,
    stop: () => {
      doc.removeEventListener('pointerdown', inUse, true);
      doc.removeEventListener('keydown', inUse, true);
    },
  };
}

/** Starts watching for a new version. Returns a way to stop. */
export function startQuietUpdates(deps: QuietUpdateDeps): () => void {
  const doc = deps.doc ?? document;
  const store = deps.store ?? sessionStore();
  const away = watchReturn(doc);
  let waiting: string | null = null;

  /** Reloads for the waiting version, once per version and tab. */
  const reloadFor = (href: string | null) => {
    if (!waiting) return false;
    try {
      if (store?.getItem(RELOADED_FOR) === waiting) return false;
      store?.setItem(RELOADED_FOR, waiting);
    } catch {
      // No storage: reload anyway, as a new tab would.
    }
    deps.load(href);
    return true;
  };
  /** A tab reloads while it is in the background; the installed app when it is just back. */
  const reloadIfSafe = () => {
    const safe = deps.installed ? away.justBack() : doc.visibilityState === 'hidden';
    if (safe && !hasUnsentText(doc)) reloadFor(null);
  };
  const check = async () => {
    const live = await deps.liveVersion();
    if (!live || live === deps.current) return;
    waiting = live;
    reloadIfSafe();
  };
  const onVisibility = () => {
    if (doc.visibilityState !== 'visible') {
      away.hidden();
      return reloadIfSafe();
    }
    away.shown();
    reloadIfSafe();
    void check();
  };

  const timer = setInterval(() => void check(), CHECK_EVERY_MS);
  doc.addEventListener('visibilitychange', onVisibility);
  const stopNavigation = deps.onNavigate((navigation) => {
    // Only a tab, and only a move to another page: a changed filter keeps the page as it is.
    if (deps.installed || !navigation.pathChanged || hasUnsentText(doc)) return;
    reloadFor(navigation.toLocation.href);
  });
  void check();
  return () => {
    clearInterval(timer);
    doc.removeEventListener('visibilitychange', onVisibility);
    stopNavigation();
    away.stop();
  };
}
