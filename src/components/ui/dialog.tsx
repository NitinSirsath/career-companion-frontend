import * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Close } from '@carbon/icons-react';
import { cn } from '../../lib/utils';

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </BaseDialog.Root>
  );
}

export function DialogTrigger({
  asChild,
  children,
  ...props
}: {
  asChild?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  if (asChild && React.isValidElement(children)) {
    return <BaseDialog.Trigger render={children} {...props} />;
  }
  return <BaseDialog.Trigger {...props}>{children}</BaseDialog.Trigger>;
}

/**
 * A modal: fades and rises in 240ms and leaves the same way. It has a close button; Escape and a
 * click outside also close it.
 */
export function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-240 ease-entrance data-ending-style:opacity-0 data-ending-style:ease-exit data-starting-style:opacity-0" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <BaseDialog.Popup
          className={cn(
            'relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-y-auto bg-surface px-4 pt-4 pb-0 text-text-primary outline-none transition-[opacity,transform] duration-240 ease-entrance data-ending-style:translate-y-6 data-ending-style:opacity-0 data-ending-style:ease-exit data-starting-style:translate-y-6 data-starting-style:opacity-0',
            className,
          )}
          {...props}
        >
          {children}
          <BaseDialog.Close
            aria-label="Close dialog"
            className="absolute top-0 right-0 flex size-12 cursor-pointer items-center justify-center text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover"
          >
            <Close size={20} aria-hidden="true" />
          </BaseDialog.Close>
        </BaseDialog.Popup>
      </div>
    </BaseDialog.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-6 flex flex-col gap-1 pr-10 text-left', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <BaseDialog.Title
      render={<h3 />}
      className={cn('text-xl leading-7 font-normal', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <BaseDialog.Description className={cn('text-sm text-text-secondary', className)} {...props} />
  );
}

/** The buttons along the bottom edge, each taking an equal share, as in IBM Carbon. */
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        '-mx-4 mt-8 flex [&>button]:h-16 [&>button]:flex-1 [&>button]:items-start [&>button]:justify-start [&>button]:px-4 [&>button]:pt-3.5',
        className,
      )}
      {...props}
    />
  );
}
