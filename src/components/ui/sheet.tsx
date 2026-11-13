import { useLayoutEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { CheckIcon, XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { MenuAction } from './menu';

/** How much the page behind shrinks: fully behind a tall sheet, half behind a short one. */
function useShrinkBehind(open: boolean, tall: boolean) {
  useLayoutEffect(() => {
    if (!open) return;
    document.documentElement.style.setProperty('--sheet-shrink', tall ? '1' : '0.55');
  }, [open, tall]);
}

const POPUP =
  'phone-type flex flex-col overflow-hidden bg-surface-raised text-text-primary shadow-[0_12px_44px_rgb(0_0_0/0.32),inset_0_0_0_0.5px_var(--glass-edge)] outline-none will-change-transform [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-450 ease-sheet data-swiping:duration-0 data-swiping:select-none data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:[transform:none] motion-reduce:transition-opacity motion-reduce:data-starting-style:opacity-0 motion-reduce:data-ending-style:opacity-0';

/** The sheet's title row: the name, then a round Close. */
export function SheetHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-[58px] shrink-0 items-center gap-2.5 py-1 pr-3 pl-[22px]">
      <Drawer.Title className="min-w-0 flex-1 text-[19px] leading-6 font-[650]">
        {title}
      </Drawer.Title>
      {children}
      <Drawer.Close
        aria-label="Close"
        className="flex size-[38px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-layer-accent text-text-primary transition-transform duration-450 ease-[cubic-bezier(0.25,1.6,0.4,1)] active:scale-110"
      >
        <XIcon size={20} aria-hidden="true" />
      </Drawer.Close>
    </div>
  );
}

/**
 * A sheet on phones (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): it floats over the page
 * with round corners and springs up; drag it down and it follows the finger, fling it or drag it
 * far enough and it closes. The page behind shrinks a little. `tall` sheets (Reply) reach almost
 * to the top. `header` replaces the title row; `footer` stays at the bottom (text tools).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  tall = false,
  header,
  footer,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  tall?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  useShrinkBehind(open, tall);
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-50 bg-black/25 opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-450 ease-sheet data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] dark:bg-black/50" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
          <Drawer.Popup
            className={cn(
              POPUP,
              tall
                ? 'h-[calc(100dvh-env(safe-area-inset-top)-12px)] w-full rounded-t-[22px]'
                : 'mb-2 max-h-[calc(100dvh-env(safe-area-inset-top)-46px)] w-[calc(100%-16px)] rounded-[28px] rounded-b-[36px]',
              className,
            )}
          >
            <span
              aria-hidden="true"
              className="mx-auto mt-[7px] h-[5px] w-9 shrink-0 rounded-full bg-border-strong/60"
            />
            {header ?? <SheetHeader title={title} />}
            <Drawer.Content className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-[calc(22px+env(safe-area-inset-bottom)*0.4)]">
              {children}
            </Drawer.Content>
            {footer}
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/** Rows on a soft grey group inside a sheet, with thin lines between them. */
export function SheetGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div
      role={label ? 'group' : undefined}
      aria-label={label}
      className="grouped-rows overflow-hidden rounded-2xl bg-layer-accent"
    >
      {children}
    </div>
  );
}

/** One row of a sheet's actions: 52px, an icon, red for a danger, a tick for the chosen one. */
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
      role={chosen === undefined ? undefined : 'menuitemradio'}
      aria-checked={chosen}
      className={cn(
        'flex min-h-[52px] w-full cursor-pointer items-center gap-3 px-[18px] text-left text-[17px] transition-colors duration-300 active:bg-surface-selected active:duration-0 disabled:cursor-default disabled:opacity-50',
        danger ? 'text-danger-text' : 'text-text-primary',
        className,
      )}
      {...props}
    >
      {icon && <span className="flex shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1 py-2.5">{children}</span>
      {chosen && <CheckIcon size={20} aria-hidden="true" className="shrink-0 text-link" />}
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
