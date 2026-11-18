import { useCallback, useLayoutEffect, useState, type CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import { PRESS } from './GlassButton';
import type { BarMode, PhoneFrame } from './phoneNav';
import { TabBar } from './TabBar';

/** The bar's height and the Search circle's width with its gap (mock: 50px, 50 + 8px). */
const BAR_H = 50;
const SEARCH_W = 58;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the glass capsule is in each mode: the tabs, the page's field, or shrunk away. */
function capsuleStyle(mode: BarMode, width: number, field: Box | null): CSSProperties {
  const tabs = { left: 0, top: 0, width: Math.max(0, width - SEARCH_W), height: BAR_H };
  if (mode === 'tabs') return tabs;
  if (mode === 'detail' && field) return field;
  // Nothing to become: it shrinks to its middle and fades.
  return {
    left: tabs.width * 0.2,
    top: 6,
    width: tabs.width * 0.6,
    height: BAR_H - 12,
    opacity: 0,
    filter: 'blur(6px)',
  };
}

/** Watches the bar place: whether a page has put a bar there, and where its field is. */
function useSlot(width: number) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [filled, setFilled] = useState(false);
  const [field, setField] = useState<Box | null>(null);
  useLayoutEffect(() => {
    if (!slot) return;
    const read = () => {
      setFilled(slot.childElementCount > 0);
      const element = slot.querySelector<HTMLElement>('[data-bar-field]');
      if (!element) return setField(null);
      const outer = slot.getBoundingClientRect();
      const box = element.getBoundingClientRect();
      setField({
        left: box.left - outer.left,
        top: box.top - outer.top,
        width: box.width,
        height: box.height,
      });
    };
    read();
    const watch = new MutationObserver(read);
    watch.observe(slot, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, [slot, width]);
  return { setSlot, filled, field };
}

/** The bar's own width, so the glass can be placed in pixels and its moves can be eased. */
function useWidth() {
  const [width, setWidth] = useState(0);
  const [element, setElement] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() => setWidth(element.clientWidth));
    watch.observe(element);
    return () => watch.disconnect();
  }, [element]);
  return { width, place: setElement };
}

/**
 * The floating bar at the bottom of the phone (owner, 18 Nov 2026, Motion rules): on a tab's
 * first page the tab bar; on a detail page the page's bottom bar. It stays put while pages slide,
 * and one glass capsule reshapes between the two (~250ms): the tab icons blur away, the capsule
 * becomes the page's field, and the side circles fade in. Going back reverses it. A detail page
 * with no bar: the capsule shrinks away. `hint`: what the bar is about to be, while a page slides
 * back before the address changes.
 */
export function BarHost({
  nav,
  hint,
  onSearch,
}: {
  nav: PhoneFrame;
  hint: BarMode | null;
  onSearch: () => void;
}) {
  const { width, place } = useWidth();
  const { setSlot, filled, field } = useSlot(width);
  const fallback = filled ? 'detail' : 'none';
  const mode: BarMode = hint ?? (nav.isRoot ? 'tabs' : fallback);
  const slotRef = useCallback(
    (element: HTMLDivElement | null) => {
      setSlot(element);
      nav.setBarTarget(element);
    },
    [setSlot, nav],
  );
  return (
    <div
      ref={place}
      data-bar-mode={mode}
      className="pointer-events-none absolute inset-x-[14px] bottom-[max(calc(env(safe-area-inset-bottom)-12px),10px)] z-50 h-[50px]"
    >
      <div
        className={cn(
          'absolute inset-0 origin-[40%_50%] has-[nav[aria-label=Main]:active]:scale-[1.03]',
          PRESS,
          mode === 'tabs' && 'pointer-events-auto',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'glass motion-fade absolute rounded-full transition-[left,top,width,height,opacity,filter] duration-250 ease-morph',
            (width === 0 || (mode === 'detail' && !field)) && 'opacity-0',
          )}
          style={capsuleStyle(mode, width, field)}
        />
        <TabBar nav={nav} hidden={mode !== 'tabs'} onSearch={onSearch} />
      </div>
      <div
        ref={slotRef}
        inert={mode !== 'detail'}
        className={cn(
          'motion-fade absolute inset-0 transition-opacity duration-250 ease-morph',
          mode === 'detail' ? 'pointer-events-auto opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
