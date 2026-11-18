import { useLayoutEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { CheckIcon, XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MenuAction } from './menu';

/** How much the page behind shrinks: fully behind a tall sheet, half behind a short one. */
function useShrinkBehind(open: boolean, tall: boolean) {
  useLayoutEffect(() => {
    if (!open) return;
    document.documentElement.style.setProperty('--sheet-shrink', tall ? '1' : '0');
  }, [open, tall]);
}

/**
 * Slides up in ~300ms and settles with a tiny overshoot; closing is a bit faster, and a drag
 * closes as fast as it was flung (Motion rules, 18 Nov 2026). Reduce Motion: a fade.
 */
const POPUP =
  'phone-type flex flex-col overflow-hidden text-text-primary outline-none will-change-transform [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-300 ease-settle data-swiping:duration-0 data-swiping:select-none data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*240ms)] data-ending-style:ease-exit motion-reduce:[transform:none] motion-reduce:transition-opacity motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:opacity-0';

/** A floating sheet: inset on all sides, very round, on frosted glass (mock: `.fsheet`). */
const FLOATING =
  'mb-[calc(8px+var(--drawer-keyboard-inset,0px))] max-h-[calc(100dvh-env(safe-area-inset-top)-46px-var(--drawer-keyboard-inset,0px))] w-[calc(100%-16px)] rounded-[38px] bg-[var(--sheet-glass)] shadow-[0_16px_40px_rgb(0_0_0/0.4),inset_0_0_0_0.5px_var(--glass-edge)] backdrop-blur-[28px] backdrop-saturate-[1.8]';

/**
 * A tall sheet that pushes the page behind back (mock: `.bigsheet`). It keeps its height and
 * takes the keyboard's room as padding inside, so its own colour fills the strip behind the
 * iPhone's ˄ ˅ ✓ bar: as a margin, that strip stayed empty and the page behind showed through
 * (owner, 15 Nov 2026).
 */
const TALL =
  'h-[calc(100dvh-env(safe-area-inset-top)-12px)] w-full rounded-t-[34px] bg-background pb-[var(--drawer-keyboard-inset,0px)] shadow-[0_-8px_30px_rgb(0_0_0/0.35)]';

/** The × in a glass circle that closes a sheet (mock: `.sh .gc`). */
function CloseCircle({ label = 'Close' }: { label?: string }) {
  return (
    <Drawer.Close
      aria-label={label}
      className="glass flex size-[38px] shrink-0 cursor-pointer items-center justify-center justify-self-start rounded-full text-text-primary transition-transform duration-450 ease-[cubic-bezier(0.25,1.6,0.4,1)] active:scale-110 active:duration-120"
    >
      <XIcon size={17} aria-hidden="true" />
    </Drawer.Close>
  );
}

/**
 * A sheet's title row (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 3): the glass × at
 * the left, the name in the middle, room for one control at the right (`children`).
 */
export function SheetHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="grid min-h-[54px] shrink-0 grid-cols-[42px_1fr_42px] items-center gap-1 px-3 pt-3 pb-1.5">
      <CloseCircle />
      <Drawer.Title className="min-w-0 truncate text-center text-[16px] leading-[21px] font-semibold">
        {title}
      </Drawer.Title>
      <div className="flex justify-self-end">{children}</div>
    </div>
  );
}

/**
 * A tall sheet's title row (Reply): Close at the left, the name in the middle, the main action
 * (Send) at the right.
 */
export function SheetCenterHeader({
  title,
  closeLabel = 'Close',
  end,
}: {
  title: ReactNode;
  closeLabel?: string;
  end?: ReactNode;
}) {
  return (
    <div className="grid min-h-[58px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2.5 px-3 pt-3 pb-2">
      <CloseCircle label={closeLabel} />
      <Drawer.Title className="text-center text-[16px] leading-[21px] font-semibold">
        {title}
      </Drawer.Title>
      <div className="flex justify-self-end">{end}</div>
    </div>
  );
}

/** True once the sheet's content is scrolled: a thin line then shows under the title row. */
function useScrolledLine(open: boolean) {
  const [scrolled, setScrolled] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    setScrolled(false);
  }
  const onScroll = (event: React.UIEvent<HTMLElement>) =>
    setScrolled(event.currentTarget.scrollTop > 0);
  return { scrolled, onScroll };
}

/**
 * A sheet on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screens 3, 4, 14 and 15). A
 * floating sheet sits inset on all sides with very round corners on frosted glass, a glass × at
 * the left; it is used for every choice, and the page behind darkens a little. A `tall` sheet
 * (Reply, Message) reaches almost to the top and pushes the page behind back. Both slide up and
 * settle; drag one down and it follows the finger, fling it or drag it far enough and it closes.
 * `header` replaces the title row; `footer` stays at the bottom (text tools). A thin line shows
 * under the title row once the content scrolls under it.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  tall = false,
  header,
  footer,
  className,
  contentClassName,
  initialFocus = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  tall?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Changes the content's own spacing (the Reply sheet's narrower sides). */
  contentClassName?: string;
  /** False: the sheet leaves the focus to its own fields (the reply's text or AI hint). */
  initialFocus?: boolean;
  children: ReactNode;
}) {
  useShrinkBehind(open, tall);
  const line = useScrolledLine(open);
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      {/* The phone's keyboard pushes the sheet's content up, so fields and the tools stay in view. */}
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop
            className={cn(
              'motion-fade fixed inset-0 z-50 opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-300 ease-standard data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*240ms)]',
              tall ? 'bg-transparent' : 'bg-[var(--sheet-dim)]',
            )}
          />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
            <Drawer.Popup
              initialFocus={initialFocus}
              className={cn(POPUP, tall ? TALL : FLOATING, className)}
            >
              <div
                className={cn(
                  'shrink-0 border-b transition-colors duration-200',
                  line.scrolled ? 'border-border-subtle' : 'border-transparent',
                )}
              >
                {header ?? <SheetHeader title={title} />}
              </div>
              <Drawer.Content
                onScroll={line.onScroll}
                className={cn(
                  'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-[calc(22px+env(safe-area-inset-bottom)*0.4)]',
                  contentClassName,
                )}
              >
                {children}
              </Drawer.Content>
              {footer}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}

/** Words and fields in a sheet, spaced as the sheet's own content. */
export function SheetBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-col gap-3', className)}>{children}</div>;
}

/** Plain rows inside a sheet, edge to edge, with no box around them (mock: `.opt`). */
export function SheetGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div role={label ? 'group' : undefined} aria-label={label} className="-mx-5 flex flex-col">
      {children}
    </div>
  );
}

/**
 * One row of a sheet's choices or actions (mock: `.opt`): 46px, a ring or icon, 16px words, red
 * for a danger, a blue tick for the chosen one, grey while pressed.
 */
export function SheetAction({
  icon,
  danger = false,
  chosen,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  danger?: boolean;
  /** In a picker: true for the chosen row (a tick shows), false for the others. */
  chosen?: boolean;
}) {
  return (
    <button
      type="button"
      role={chosen === undefined ? undefined : 'radio'}
      aria-checked={chosen}
      className={cn(
        'flex min-h-[46px] w-full cursor-pointer items-center gap-[13px] px-[22px] text-left text-[16px] leading-[21px] transition-colors duration-300 active:bg-[var(--glass-pill)] active:duration-0 disabled:cursor-default disabled:opacity-50',
        danger ? 'text-danger-text' : 'text-text-primary',
        className,
      )}
      {...props}
    >
      {icon && <span className="flex shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1 py-2">{children}</span>
      {chosen && <CheckIcon size={18} aria-hidden="true" className="shrink-0 text-accent" />}
    </button>
  );
}

/**
 * A list of actions in a sheet: what "More" is on a phone. The sheet closes first, so a dialog an
 * action opens comes up on its own.
 */
export function ActionSheet({
  open,
  onOpenChange,
  title,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  actions: readonly (MenuAction & { icon?: ReactNode })[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      <SheetGroup label={title}>
        {actions.map((action) => (
          <SheetAction
            key={action.label}
            icon={action.icon}
            danger={action.danger}
            disabled={action.disabled}
            onClick={() => {
              onOpenChange(false);
              action.onSelect();
            }}
          >
            {action.label}
          </SheetAction>
        ))}
      </SheetGroup>
    </Sheet>
  );
}
