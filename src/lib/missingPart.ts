/**
 * A part of the app that loads later (the reply box) can be gone from the server once a new
 * version is live. The build reports that as `vite:preloadError`. The page is then loaded again to
 * get the version that has the part: once per version, so old files that keep coming back cannot
 * make it loop, and never while something typed is not sent.
 */
import { hasUnsentText } from './quietUpdate';

/** Where this tab notes the version it already loaded again for a missing part. */
const RELOADED_FOR = 'northlist-reloaded-for-part';

export type MissingPartDeps = {
  /** The version this page was built as. */
  current: string;
  /** Loads the page again, in place. */
  load: () => void;
  target?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  doc?: Document;
  store?: Pick<Storage, 'getItem' | 'setItem'>;
};

/** Starts watching for a part that fails to load. Returns a way to stop. */
export function watchMissingParts(deps: MissingPartDeps): () => void {
  const target = deps.target ?? window;
  const onMissing = () => {
    if (hasUnsentText(deps.doc ?? document)) return;
    try {
      const store = deps.store ?? window.sessionStorage;
      if (store.getItem(RELOADED_FOR) === deps.current) return;
      store.setItem(RELOADED_FOR, deps.current);
    } catch {
      // Nothing to remember the try with: better no second load than a loop.
      return;
    }
    deps.load();
  };
  target.addEventListener('vite:preloadError', onMissing);
  return () => target.removeEventListener('vite:preloadError', onMissing);
}
