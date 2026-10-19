import { cn } from '../../lib/utils';

/** A small busy circle in the current text colour. Screen readers get the busy state elsewhere. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
    />
  );
}
