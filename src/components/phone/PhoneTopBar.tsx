import { useLayoutEffect, useState, type Ref } from 'react';
import { ChevronLeftIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from './GlassButton';
import type { PhoneFrame } from './phoneNav';

/**
 * Tells the page how wide the buttons at the right are (`--phone-actions-w`), so a list's big
 * title, which sits in the same row, stops before them.
 */
function useActionsWidth(place?: (element: HTMLElement | null) => void) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const page = actions?.closest<HTMLElement>('[data-phone-page]');
    if (!actions || !page || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(() =>
      page.style.setProperty('--phone-actions-w', `${actions.offsetWidth}px`),
    );
    watch.observe(actions);
    return () => watch.disconnect();
  }, [actions]);
  return (element: HTMLDivElement | null) => {
    setActions(element);
    place?.(element);
  };
}

/**
 * The phone top bar (owner, 13 Nov 2026; 18 Nov 2026, mock `PHONE-LINEAR-mock/`): glass buttons
 * that float over the page, with no bar of their own. On a list, the big title sits at the left
 * of this row and the page's 1–3 icons in one glass capsule at the right; on a detail page, a
 * glass Back circle at the left and the capsule at the right. The small title fades into the
 * middle once the big title has scrolled away.
 */
export function PhoneTopBar({
  nav,
  shown,
  ref,
}: {
  nav: PhoneFrame;
  shown: boolean;
  ref?: Ref<HTMLDivElement>;
}) {
  const { depth, back, titleWords, actionsPlace } = nav;
  const placeActions = useActionsWidth(actionsPlace);
  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[calc(env(safe-area-inset-top)+52px)] items-center gap-2.5 px-3.5 pt-[env(safe-area-inset-top)]"
    >
      <div className="flex min-w-11 shrink-0">
        {depth > 1 && (
          <GlassButton label="Back" onClick={back} className="pointer-events-auto">
            <ChevronLeftIcon size={26} aria-hidden="true" />
          </GlassButton>
        )}
      </div>
      <p
        aria-hidden={!shown}
        className={cn(
          'motion-fade min-w-0 flex-1 truncate text-center text-[15.5px] leading-[21px] font-semibold transition-[opacity,translate] duration-220 ease-standard',
          shown ? 'opacity-100' : 'translate-y-1.5 opacity-0',
        )}
      >
        {titleWords}
      </p>
      <div
        ref={placeActions}
        className="pointer-events-auto flex min-w-11 shrink-0 items-center justify-end gap-2"
      />
    </div>
  );
}
