import { useEffect } from 'react';

const ITEM =
  '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="option"]';
/** A finger must move this far over an open menu before it counts as sliding, not a tap. */
const SLOP_PX = 8;

const itemAt = (x: number, y: number) =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>(ITEM) ?? null;

/**
 * Menus that follow the finger, as on an iPhone (owner, 18 Nov 2026, Motion rules): on an open
 * menu, slide a finger over the items and the highlight follows it; let go on one to pick it.
 * A plain tap works as before. Touch only; mice already highlight on hover.
 */
export function useFingerMenus() {
  useEffect(() => {
    let start: { x: number; y: number } | null = null;
    let sliding = false;
    let swallowClick = false;
    const down = (event: PointerEvent) => {
      const onMenu = (event.target as Element | null)?.closest?.('[role="menu"], [role="listbox"]');
      start =
        event.pointerType === 'touch' && onMenu ? { x: event.clientX, y: event.clientY } : null;
      sliding = false;
    };
    const move = (event: PointerEvent) => {
      if (!start) return;
      if (!sliding && Math.hypot(event.clientX - start.x, event.clientY - start.y) < SLOP_PX)
        return;
      sliding = true;
      const item = itemAt(event.clientX, event.clientY);
      if (item && document.activeElement !== item) item.focus({ preventScroll: true });
    };
    const up = (event: PointerEvent) => {
      if (!start) return;
      start = null;
      if (!sliding) return;
      const item = itemAt(event.clientX, event.clientY);
      // The browser's own click would go to where the finger first touched: pick where it is now.
      swallowClick = true;
      window.setTimeout(() => (swallowClick = false), 400);
      if (item && item.getAttribute('aria-disabled') !== 'true') {
        swallowClick = false;
        item.click();
        swallowClick = true;
      }
    };
    const click = (event: MouseEvent) => {
      if (!swallowClick || !event.isTrusted) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('click', click, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('click', click, true);
    };
  }, []);
}
