import { useEffect, useRef, useState } from 'react';

/** How far a pull at the top can grow the big title: 140px of pull, 20% bigger. */
const PULL_MAX = 140;
const PULL_GROWTH = 700;

/**
 * Follows a phone page's scroll (owner, 13 Nov 2026): the soft blur under the top bar fades in,
 * the small title shows once the big title (marked `data-big-title`) is under the bar, and
 * pulling down at the top (iPhone only) makes the big title a little bigger. Drawn straight on
 * the elements, every frame. `words`: the big title's words; a new title is a new page to follow.
 */
export function usePageScroll(words: string | null) {
  const scroller = useRef<HTMLDivElement>(null);
  const edge = useRef<HTMLDivElement>(null);
  const topBar = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () => {
      const top = element.scrollTop;
      if (edge.current) edge.current.style.opacity = String(Math.max(0, Math.min(1, top / 22)));
      const title = element.querySelector<HTMLElement>('[data-big-title]');
      const barBottom = topBar.current?.getBoundingClientRect().bottom ?? 0;
      setShown(title ? title.getBoundingClientRect().bottom < barBottom + 2 : top > 8);
      if (title)
        title.style.transform =
          top < 0 ? `scale(${1 + Math.min(-top, PULL_MAX) / PULL_GROWTH})` : '';
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    return () => element.removeEventListener('scroll', update);
  }, [words]);
  return { scroller, edge, topBar, shown };
}
