/*
 * Motion plays once, small, and not at all when the visitor asks for less motion: then every
 * moving picture shows its end state and the replay buttons are hidden (`html.no-motion`).
 */
export const noMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Runs `play` once, when `threshold` of `el` is in view; at once with `still = true` under less motion. */
export function whenSeen(el: Element, play: (still: boolean) => void, threshold = 0.25): void {
  if (noMotion || !('IntersectionObserver' in window)) return play(true);
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        io.disconnect();
        play(false);
      }
    },
    { threshold },
  );
  io.observe(el);
}

/** Each self-playing picture has a replay button: `[data-replay="<name>"]`. */
export function onReplay(name: string, replay: () => void): void {
  document.querySelectorAll(`[data-replay="${name}"]`).forEach((b) => b.addEventListener('click', replay));
}

/** Sections fade up 8 px once, when they come into view (`.rv`). */
export function startReveal(): void {
  const items = document.querySelectorAll('.rv');
  if (noMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      }),
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
  );
  items.forEach((el) => io.observe(el));
}
