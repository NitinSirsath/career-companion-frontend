import { cn } from '../../lib/utils';

/** A grey shape that shimmers where content is loading. Size it like the content it stands for. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('skeleton block h-4', className)} />;
}

/** Skeleton lines for a list or a card while it loads, with a hidden "Loading" for screen readers. */
export function SkeletonList({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" className="flex flex-col gap-4 py-2">
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
