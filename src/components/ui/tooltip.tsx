import * as React from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { cn } from '../../lib/utils';

export const TooltipProvider = BaseTooltip.Provider;

const ClickContext = React.createContext<{ open: boolean; click: () => void } | null>(null);

/**
 * What does not close a tooltip a click opened: the mouse leaving it, focus moving away, and Base
 * UI's own press on the trigger (the click itself closes it).
 */
const KEPT_OPEN_ON: readonly BaseTooltip.Root.ChangeEventReason[] = [
  'trigger-hover',
  'trigger-focus',
  'trigger-press',
];

/**
 * Opens on hover and focus. A click or tap opens it and keeps it open, also when it was already
 * open from hover: phones have no hover. A second click, a click outside or Escape closes it.
 */
export function Tooltip(props: React.ComponentProps<typeof BaseTooltip.Root>) {
  const [open, setOpen] = React.useState(false);
  const [clicked, setClicked] = React.useState(false);
  const click = React.useMemo(
    () => ({
      open,
      click: () => {
        setOpen(!clicked);
        setClicked(!clicked);
      },
    }),
    [open, clicked],
  );
  return (
    <ClickContext.Provider value={click}>
      <BaseTooltip.Root
        {...props}
        open={open}
        onOpenChange={(next, { reason }) => {
          if (!next && clicked && KEPT_OPEN_ON.includes(reason)) return;
          setOpen(next);
          if (!next) setClicked(false);
        }}
      />
    </ClickContext.Provider>
  );
}

export const TooltipTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof BaseTooltip.Trigger>
>(({ onClick, ...props }, ref) => {
  const clicks = React.useContext(ClickContext);
  return (
    <BaseTooltip.Trigger
      ref={ref}
      closeOnClick={false}
      aria-expanded={clicks?.open}
      onClick={(event) => {
        onClick?.(event);
        clicks?.click();
      }}
      {...props}
    />
  );
});
TooltipTrigger.displayName = 'TooltipTrigger';

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof BaseTooltip.Popup>,
  React.ComponentPropsWithoutRef<typeof BaseTooltip.Popup>
>(({ className, ...props }, ref) => (
  <BaseTooltip.Portal>
    <BaseTooltip.Positioner sideOffset={8}>
      <BaseTooltip.Popup
        ref={ref}
        className={cn(
          'z-50 max-w-[280px] rounded-lg border bg-card px-3 py-2 text-xs font-medium text-card-foreground shadow-lg outline-none leading-relaxed',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
          'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      >
        {props.children}
        <BaseTooltip.Arrow className="fill-card" />
      </BaseTooltip.Popup>
    </BaseTooltip.Positioner>
  </BaseTooltip.Portal>
));
TooltipContent.displayName = 'TooltipContent';
