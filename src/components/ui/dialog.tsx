import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "../../lib/utils";

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

export function DialogContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/50 transition-opacity" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <BaseDialog.Popup
          className={cn(
            "relative w-full max-w-lg border border-border bg-surface p-6 shadow-lg overflow-y-auto max-h-[90vh] outline-none",
            className,
          )}
          {...props}
        >
          {children}
        </BaseDialog.Popup>
      </div>
    </BaseDialog.Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 mb-4 text-left", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <BaseDialog.Title
      render={<h3 />}
      className={cn(
        "text-lg font-medium leading-none tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 pt-4",
        className,
      )}
      {...props}
    />
  );
}
