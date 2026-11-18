import { useEffect, useRef, useState } from 'react';

/** How far a pull at the top can grow the big title: 140px of pull, 20% bigger. */
const PULL_MAX = 140;
const PULL_GROWTH = 700;

/**
 * Follows a phone page's scroll (owner, 13 Nov 2026; 18 Nov 2026 for lists): the soft blur under
 * the top bar fades in, the small title fades into the bar once the big title (marked
 * `data-big-title`) has scrolled away, and pulling down at the top (iPhone only) makes the big
 * title a little bigger. A list's big title starts in the same row as the bar's buttons, so its
 * small title shows once half of it has gone under them. Drawn straight on the elements, every
 * frame. `words`: the big title's words; a new title is a new page to follow. A title marked
 * `data-bar-title` (PhoneTitle size="bar") has no big title: the small title always shows.
 */
export function usePageScroll(words: string | null, isRoot: boolean) {
  const [element, setScroller] = useState<HTMLElement | null>(null);
  const edge = useRef<HTMLDivElement>(null);
  const topBar = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!element) return;
    const update = () => {
      const top = element.scrollTop;
      if (edge.current) edge.current.style.opacity = String(Math.max(0, Math.min(1, top / 22)));
      const title = element.querySelector<HTMLElement>('[data-big-title]');
      // A setup page's title lives only in the bar, so it always shows.
      if (element.querySelector('[data-bar-title]')) return setShown(true);
      const bar = topBar.current?.getBoundingClientRect();
      const line = isRoot ? (bar?.top ?? 0) + (bar?.height ?? 0) / 2 : (bar?.bottom ?? 0) + 2;
      setShown(title ? title.getBoundingClientRect().bottom < line : top > 8);
      if (title)
        title.style.transform =
          top < 0 ? `scale(${1 + Math.min(-top, PULL_MAX) / PULL_GROWTH})` : '';
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    return () => element.removeEventListener('scroll', update);
  }, [element, words, isRoot]);
  return { setScroller, edge, topBar, shown };
}
