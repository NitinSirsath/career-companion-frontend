import { STARTUP_LEAVE_MS } from './startup';

/**
 * The start-up mark is drawn by `index.html`, outside the app, so it shows before the app's code
 * arrives and never restarts. The start-up screen only makes it still or lets it go; with no mark
 * on the page (tests, a second start-up screen) nothing happens.
 */
const findMark = (doc: Document) => doc.getElementById('startup');

let leaving: ReturnType<typeof setTimeout> | undefined;

/** Keeps the mark; still (grey, not moving) when nothing is loading. */
export function holdStartupMark(still: boolean, doc: Document = document) {
  clearTimeout(leaving);
  leaving = undefined;
  const mark = findMark(doc);
  mark?.classList.remove('startup-leave');
  mark?.toggleAttribute('data-still', still);
}

/**
 * Lets the mark fade away over the app, then removes it. It waits one turn first: React's dev
 * mode unmounts and mounts the start-up screen again at once, and that must not lose the mark.
 */
export function releaseStartupMark(doc: Document = document) {
  clearTimeout(leaving);
  leaving = setTimeout(() => {
    const mark = findMark(doc);
    if (!mark) return;
    mark.classList.add('startup-leave');
    leaving = setTimeout(() => mark.remove(), STARTUP_LEAVE_MS);
  }, 0);
}
