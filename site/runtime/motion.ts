/*
 * Motion plays once, small, and not at all when the visitor asks for less motion (or the address has
 * `?static`, for checks and screenshots): then every moving picture shows its end state and the replay
 * buttons are hidden (`html.no-motion`).
 */
export const noMotion =
  matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('static');

/*
 * Home's hero intro (owner, 1 Nov 2026, after linear.app; styles/states.css "Hero intro"). The page head
 * sets `html.intro`, so the hero waits hidden from the first paint. It plays once, when the header, the
 * example and the font are in (the font gets 300 ms at most). A scroll during it shows everything at
 * once; 2.3 s after it starts the classes go, so nothing is left animating.
 */
export function startIntro(): void {
  const root = document.documentElement;
  if (!root.classList.contains('intro')) return;
  const finish = () => {
    root.classList.remove('intro', 'intro-go');
    removeEventListener('scroll', finish);
  };
  if (noMotion) return finish();
  const font = document.fonts ? document.fonts.load('560 16px Geist').catch(() => {}) : null;
  void Promise.race([font, new Promise((r) => setTimeout(r, 300))]).then(() =>
    requestAnimationFrame(() => {
      root.classList.add('intro-go');
      addEventListener('scroll', finish, { passive: true });
      setTimeout(finish, 2300); // the intro takes 2 s
    }),
  );
}

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
