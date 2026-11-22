/**
 * Moves between whole screens with the browser's view transitions (the first run, owner 22 Nov
 * 2026): a step slides in from the side it comes from, and a new theme grows as a circle from the
 * tap. Where the browser has no view transitions, or with Reduce Motion, the change is instant.
 */
import { flushSync } from 'react-dom';

export type TransitionType = 'forward' | 'backward' | 'theme';

export const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Runs a React state change inside a view transition of the given type, when there is one. */
export function transition(update: () => void, type: TransitionType): ViewTransition | null {
  const commit = () => flushSync(update);
  if (typeof document.startViewTransition !== 'function' || reducedMotion()) {
    commit();
    return null;
  }
  let started: ViewTransition;
  try {
    started = document.startViewTransition({ update: commit, types: [type] });
  } catch {
    // Browsers before transition types take only the update.
    started = document.startViewTransition(commit);
  }
  // A transition skipped by the browser (a hidden tab) still runs the update; nothing to report.
  started.ready.catch(() => undefined);
  started.finished.catch(() => undefined);
  started.updateCallbackDone.catch(() => undefined);
  return started;
}

/** A theme change that grows as a circle from (x, y), the point that was tapped. */
export function themeReveal(update: () => void, x: number, y: number) {
  const started = transition(update, 'theme');
  if (!started) return;
  void started.ready
    .then(() => {
      const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      document.documentElement.animate(
        { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 650,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => undefined);
}
