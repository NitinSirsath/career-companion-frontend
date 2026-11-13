import type { Ref } from 'react';
import { ChevronLeftIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { GlassButton } from './GlassButton';
import type { PhoneFrame } from './phoneNav';

/**
 * The phone top bar (owner, 13 Nov 2026): round frosted buttons over the page, with no bar of its
 * own. Back on the left when a page is open on top of another; the page's own buttons on the
 * right (on a list: refresh, search and filters in one capsule; on a mail: one ⓘ). The small title
 * shows in the middle once the big title has scrolled under it.
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
          'min-w-0 flex-1 truncate text-center text-[17px] leading-[22px] font-semibold transition-[opacity,translate] duration-220 ease-standard',
          shown ? 'opacity-100' : 'translate-y-1.5 opacity-0',
        )}
      >
        {titleWords}
      </p>
      <div
        ref={actionsPlace}
        className="pointer-events-auto flex min-w-11 shrink-0 items-center justify-end gap-2"
      />
    </div>
  );
}
