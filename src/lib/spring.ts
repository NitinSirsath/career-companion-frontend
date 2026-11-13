/**
 * Springs for the phone's motion (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`). Every move
 * is a spring, so a fling keeps its speed and a page or sheet settles the way an iPhone's does.
 * A spring is given as iOS gives it: how long one swing takes (response, seconds) and how quickly
 * it calms down (damping: 1 settles without overshoot, less overshoots a little).
 */
export interface Spring {
  /** Stiffness. */
  k: number;
  /** Friction. */
  c: number;
}

export function spring(response: number, damping: number): Spring {
  const w = (2 * Math.PI) / response;
  return { k: w * w, c: 2 * damping * w };
}

/** Pages sliding in and out. */
export const NAV_SPRING = spring(0.42, 1);
/** A highlight or thumb moving to its new place. */
export const SNAP_SPRING = spring(0.36, 0.78);

/** Moves a value one frame further: semi-implicit Euler in small steps, so it never blows up. */
export function stepSpring(
  [x, v]: [number, number],
  to: number,
  dt: number,
  { k, c }: Spring,
): [number, number] {
  const steps = Math.max(1, Math.ceil(dt / 0.004));
  const h = dt / steps;
  let position = x;
  let velocity = v;
  for (let i = 0; i < steps; i += 1) {
    velocity += (-k * (position - to) - c * velocity) * h;
    position += velocity * h;
  }
  return [position, velocity];
}

/** True once the value is at rest at its target. */
export const springSettled = (x: number, v: number, to: number) =>
  Math.abs(x - to) < 0.0006 && Math.abs(v) < 0.006;

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A move: where it starts, where it ends, and how fast it already goes (a fling). */
export interface SpringMove {
  from: number;
  to: number;
  velocity?: number;
}

/**
 * Runs a spring from `from` to `to`, calling `onFrame` with each value; resolves at rest. When the
 * device asks for less motion it is a short fade instead: the value goes straight to `to` over
 * 200ms, and the caller draws it as opacity.
 */
export function animateSpring(
  { from, to, velocity = 0 }: SpringMove,
  shape: Spring,
  onFrame: (value: number) => void,
): Promise<void> {
  return new Promise((done) => {
    let last = performance.now();
    if (prefersReducedMotion()) {
      const start = last;
      const fade = (now: number) => {
        const t = Math.min(1, (now - start) / 200);
        onFrame(from + (to - from) * t);
        if (t < 1) requestAnimationFrame(fade);
        else done();
      };
      requestAnimationFrame(fade);
      return;
    }
    let x = from;
    let v = velocity;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      [x, v] = stepSpring([x, v], to, dt, shape);
      if (springSettled(x, v, to)) {
        onFrame(to);
        done();
        return;
      }
      onFrame(x);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
