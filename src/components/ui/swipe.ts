import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';

/** How far a row moves before letting go does the action, and how far it can move at all. */
const SWIPE_DONE_PX = 90;
const SWIPE_MAX_PX = 120;

/**
 * A row that can be swiped to the right for one action, as in phone mail apps. Returns how far the
 * row has moved and the handlers for it. A swipe never also opens the row's link.
 */
export function useSwipeRight(onSwipe: (() => void) | null) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  const moved = useRef(false);
  // Read when the finger lifts: a quick flick can end before the row is drawn at its new place.
  const distance = useRef(0);
  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (!onSwipe) return;
      start.current = event.clientX;
      moved.current = false;
      distance.current = 0;
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (start.current === null) return;
      distance.current = Math.max(0, Math.min(SWIPE_MAX_PX, event.clientX - start.current));
      if (distance.current > 6 && !moved.current) {
        moved.current = true;
        setDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      if (moved.current) setOffset(distance.current);
    },
    onPointerUp: () => {
      if (start.current === null) return;
      start.current = null;
      if (distance.current >= SWIPE_DONE_PX) onSwipe?.();
      setOffset(0);
      setDragging(false);
    },
    onPointerCancel: () => {
      start.current = null;
      setOffset(0);
      setDragging(false);
    },
    // A mouse drag on a link would start the browser's own drag of it instead.
    draggable: false,
    onClickCapture: (event: MouseEvent<HTMLElement>) => {
      if (!moved.current) return;
      moved.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
  return { offset, dragging, handlers };
}
