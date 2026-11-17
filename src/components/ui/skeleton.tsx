import { cn } from '../../lib/utils';

/**
 * A loader's side space. It is none on a normal page, which has its own side space. Inside a list
 * that runs to the phone's edges (`phone-bleed`) it is the rows' 20px, so a loader there can never
 * touch the edge.
 */
const LIST_INSET = 'px-[var(--list-inset,0px)]';

/** A grey shape that shimmers where content is loading. Size it like the content it stands for. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('skeleton block h-4', className)} />;
}

/**
 * Skeleton lines for a list or a card while it loads, with a hidden "Loading" for screen readers.
 * `className` can set other side space, for a loader inside a padded group.
 */
export function SkeletonList({
  rows = 3,
  label,
  className,
}: {
  rows?: number;
  label: string;
  className?: string;
}) {
  return (
    <div role="status" className={cn('flex flex-col gap-4 py-2', LIST_INSET, className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className={i % 2 ? 'w-2/3' : 'w-3/4'} />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Grey lines shaped like mail rows, for a mail list while it loads, so the list does not jump when
 * the mails arrive. Phones: the four lines of a phone row and its date. Laptops: the picture, the
 * three lines, the application, the date and the menu's place.
 */
export function SkeletonRows({ rows = 5, label }: { rows?: number; label: string }) {
  return (
    <div role="status" className={cn('flex flex-col', LIST_INSET)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex gap-4 border-b border-border-subtle pt-3 pb-3.5 md:px-3 md:pt-4"
        >
          <Skeleton className="hidden size-8 shrink-0 rounded-full md:block" />
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className={cn('h-4', i % 2 ? 'w-1/3' : 'w-2/5')} />
              <Skeleton className="h-3 w-14 md:hidden" />
            </div>
            <Skeleton className={cn('h-3.5', i % 2 ? 'w-2/3' : 'w-4/5')} />
            <Skeleton className={cn('h-3.5 md:hidden', i % 2 ? 'w-1/2' : 'w-3/5')} />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <div className="hidden w-[200px] shrink-0 flex-col gap-2.5 md:flex">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="hidden h-3 w-12 shrink-0 md:block" />
          <span className="hidden w-8 shrink-0 md:block" />
        </div>
      ))}
    </div>
  );
}
