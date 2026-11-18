import { useEffect, useRef, useState } from 'react';
import { animateSpring, spring } from '../../lib/spring';

/** Pull this far (after the pull's resistance) and let go to refresh; it then waits held here. */
const TRIGGER_PX = 64;
const HOLD_PX = 48;
const MAX_PX = 130;
/** The list springs back with a little give, as on an iPhone. */
const BACK_SPRING = spring(0.42, 0.82);

/**
 * Pull to refresh on a phone page (owner, 18 Nov 2026, Motion rules): at the top of the page a
 * finger pulls the content down, a small spinner shows in the gap, and letting go far enough
 * fetches the page again while the content waits a little lower; then it springs back. Touch
 * only. Returns the places for the scrolling element, the content that moves and the spinner.
 */
export function usePullToRefresh(refresh: () => Promise<unknown>) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const [spinner, setSpinner] = useState<HTMLElement | null>(null);
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!scroller || !content || !spinner) return;
    let startY: number | null = null;
    let pull = 0;
    let busy = false;
    const draw = (px: number) => {
      pull = px;
      content.style.transform = px ? `translate3d(0,${px}px,0)` : '';
      spinner.style.opacity = String(Math.min(1, px / TRIGGER_PX));
      spinner.style.transform = `translate3d(0,${px / 2 - 12}px,0)`;
    };
    const settle = (to: number) => animateSpring({ from: pull, to }, BACK_SPRING, draw);

    const start = (event: TouchEvent) => {
      startY = !busy && scroller.scrollTop <= 0 ? event.touches[0].clientY : null;
    };
    const move = (event: TouchEvent) => {
      if (startY === null) return;
      const dy = event.touches[0].clientY - startY;
      if (dy <= 0 || scroller.scrollTop > 0) {
        if (pull) draw(0);
        return;
      }
      if (event.cancelable) event.preventDefault();
      draw(Math.min(MAX_PX, dy * 0.5));
    };
    const end = async () => {
      if (startY === null) return;
      startY = null;
      if (pull < TRIGGER_PX) return void settle(0);
      busy = true;
      await settle(HOLD_PX);
      try {
        await latest.current();
      } finally {
        await settle(0);
        busy = false;
      }
    };
    scroller.addEventListener('touchstart', start, { passive: true });
    scroller.addEventListener('touchmove', move, { passive: false });
    scroller.addEventListener('touchend', end);
    scroller.addEventListener('touchcancel', end);
    return () => {
      scroller.removeEventListener('touchstart', start);
      scroller.removeEventListener('touchmove', move);
      scroller.removeEventListener('touchend', end);
      scroller.removeEventListener('touchcancel', end);
    };
  }, [scroller, content, spinner]);

  return { setScroller, setContent, setSpinner };
}
