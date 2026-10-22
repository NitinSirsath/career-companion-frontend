import * as React from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { Close } from '@carbon/icons-react';
import { cn } from '../../lib/utils';
import { AutoHeight } from './auto-height';

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
 * A modal: fades and rises in 240ms and leaves the same way. When its content changes height (an
 * error, a notice, the next step) it grows or shrinks smoothly and stays centred. It has a close
 * button; Escape and a click outside also close it.
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
            'relative flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-y-auto border border-border-subtle bg-surface text-text-primary shadow-popup outline-none transition-[opacity,translate] duration-240 ease-entrance data-ending-style:translate-y-6 data-ending-style:opacity-0 data-ending-style:ease-exit data-starting-style:translate-y-6 data-starting-style:opacity-0',
            className,
          )}
          {...props}
        >
          {/* The padding sits inside the moving box, so the footer's line runs edge to edge. */}
          <AutoHeight contentClassName="flex flex-col px-6 pt-6">{children}</AutoHeight>
          <BaseDialog.Close
            aria-label="Close dialog"
            className="absolute top-5 right-5 flex size-8 cursor-pointer items-center justify-center text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover hover:text-text-primary"
          >
            <Close size={16} aria-hidden="true" />
          </BaseDialog.Close>
        </BaseDialog.Popup>
      </div>
    </BaseDialog.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-6 flex flex-col gap-2 pr-10 text-left', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <BaseDialog.Title
      render={<h3 />}
      className={cn('text-xl leading-7 font-semibold', className)}
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

/** The buttons at the bottom right, under a line: the secondary one, then the main one. */
export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        '-mx-6 mt-6 flex flex-wrap justify-end gap-2 border-t border-border-subtle px-6 py-4',
        className,
      )}
      {...props}
    />
  );
}
