/**
 * A step back that the browser drew itself: Safari's and Chrome's own back swipe slides the page
 * and says so on the history step (`hasUAVisualTransition`). The app then adds no slide of its
 * own, or the page would slide twice.
 *
 * The note has to be taken before the router hears of the step, because the router draws the new
 * page at once. Listeners on the window run in the order they were added, whatever their kind,
 * so `watchSystemBack()` is called in `main.tsx` before the router is made.
 */
let drewAt = -Infinity;

/** Starts noting the steps back the browser drew. Call once, before the router is made. */
export function watchSystemBack(target: Pick<Window, 'addEventListener'> = window) {
  target.addEventListener('popstate', (event) => {
    if (event.hasUAVisualTransition) drewAt = performance.now();
  });
}

/** True when the browser drew the step back that just happened. */
export const browserDrewBack = () => performance.now() - drewAt < 1000;
