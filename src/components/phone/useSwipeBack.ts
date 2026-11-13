import { useEffect, useState } from 'react';

/** What the swipe drives: the stack's slide. */
export interface SwipeTarget {
  swipeStart: () => boolean;
  swipeMove: (p: number) => void;
  swipeEnd: (go: boolean, velocity: number) => void;
}

/** A finger must move this far before the page follows it. */
const SLOP_PX = 9;
/** Let go past this share of the width, or flung, and the page goes back. */
const GO_SHARE = 0.42;
const FLING_PX_PER_S = 500;

interface Gesture {
  id: number;
  x: number;
  y: number;
  points: [number, number][];
  dragging: boolean;
}

/** Places a drag must not start from: fields, and anything that scrolls sideways and can. */
function ownsDrag(target: Element, page: HTMLElement) {
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe-back]'))
    return true;
  for (let el: Element | null = target; el && el !== page; el = el.parentElement)
    if (el.scrollWidth > el.clientWidth && el.scrollLeft > 0) return true;
  return false;
}

/** Speed in px/s over the last ~90ms, so a short fling counts. */
function speed(points: [number, number][]) {
  const [x0, t0] = points[0];
  const [x1, t1] = points[points.length - 1];
  return ((x1 - x0) / Math.max(8, t1 - t0)) * 1000;
}

/**
 * Swipe back from anywhere on a page, not only the edge (owner, 13 Nov 2026): the page follows the
 * finger to the right; let go halfway and it springs back, past that or with a fling it goes back.
 * Pages scroll up and down as usual, since a mostly-vertical move never starts it. Returns the
 * callback that hands it the page.
 */
export function useSwipeBack(target: SwipeTarget) {
  const [page, setPage] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!page) return;
    let gesture: Gesture | null = null;
    let swallowClick = false;
    const width = () => page.clientWidth || window.innerWidth;

    const down = (event: PointerEvent) => {
      if (gesture || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (ownsDrag(event.target as Element, page)) return;
      gesture = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        points: [],
        dragging: false,
      };
    };
    const move = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      gesture.points.push([event.clientX, event.timeStamp]);
      while (gesture.points.length > 2 && event.timeStamp - gesture.points[0][1] > 90)
        gesture.points.shift();
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.dragging) {
        if (Math.hypot(dx, dy) < SLOP_PX) return;
        const sideways = dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.15;
        if (!sideways || !target.swipeStart()) return void (gesture = null);
        gesture.dragging = true;
        page.style.userSelect = 'none';
        page.setPointerCapture?.(event.pointerId);
      }
      target.swipeMove(Math.max(0, Math.min(1, 1 - dx / width())));
    };
    const end = (event: PointerEvent, cancelled: boolean) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const done = gesture;
      gesture = null;
      if (!done.dragging) return;
      page.style.userSelect = '';
      swallowClick = true;
      window.setTimeout(() => (swallowClick = false), 60);
      const dx = event.clientX - done.x;
      const vx = done.points.length > 1 ? speed(done.points) : 0;
      const go = !cancelled && (dx > width() * GO_SHARE || (vx > FLING_PX_PER_S && dx > 16));
      target.swipeEnd(go, -vx / width());
    };
    const up = (event: PointerEvent) => end(event, false);
    const cancel = (event: PointerEvent) => end(event, true);
    // A drag that ends on a link must not also open it.
    const click = (event: MouseEvent) => {
      if (!swallowClick) return;
      event.preventDefault();
      event.stopPropagation();
    };
    page.addEventListener('pointerdown', down, true);
    page.addEventListener('click', click, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => {
      page.removeEventListener('pointerdown', down, true);
      page.removeEventListener('click', click, true);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
  }, [page, target]);
  return setPage;
}
