/**
 * Quiet update (owner, 26 Oct 2026): an open tab takes a new version by itself, with no note and
 * nothing to click. Each build writes `version.json` and puts the same id into the app. The app
 * checks that file every 5 minutes and when the tab comes back into view. When a new version is
 * live, it reloads at a safe moment: on the next move to another page (that page opens as a full
 * load), or while the tab is in the background. It never reloads while something typed is not
 * sent, and it reloads at most once for a given version, so a cache that still serves old files
 * cannot make it loop.
 */

/** How often an open tab asks whether a new version is live. */
export const CHECK_EVERY_MS = 5 * 60_000;
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
  /** Opens a page as a full load. */
  load: (href: string | null) => void;
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

/** Starts watching for a new version. Returns a way to stop. */
export function startQuietUpdates(deps: QuietUpdateDeps): () => void {
  const doc = deps.doc ?? document;
  const store = deps.store ?? sessionStore();
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
  const reloadIfHidden = () => {
    if (doc.visibilityState === 'hidden' && !hasUnsentText(doc)) reloadFor(null);
  };
  const check = async () => {
    const live = await deps.liveVersion();
    if (!live || live === deps.current) return;
    waiting = live;
    reloadIfHidden();
  };
  const onVisibility = () => {
    if (doc.visibilityState === 'visible') void check();
    else reloadIfHidden();
  };

  const timer = setInterval(() => void check(), CHECK_EVERY_MS);
  doc.addEventListener('visibilitychange', onVisibility);
  const stopNavigation = deps.onNavigate((navigation) => {
    // Only a move to another page: a changed filter on the same page keeps the tab as it is.
    if (navigation.pathChanged && !hasUnsentText(doc)) reloadFor(navigation.toLocation.href);
  });
  void check();
  return () => {
    clearInterval(timer);
    doc.removeEventListener('visibilitychange', onVisibility);
    stopNavigation();
  };
}
