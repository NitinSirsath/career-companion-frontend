import { Skeleton } from '../ui/skeleton';

/** What the app shows while it checks who is signed in: the shape of the app, not bare text. */
export function AppSkeleton() {
  return (
    <div role="status" className="flex min-h-screen bg-background">
      <span className="sr-only">Loading Career Companion</span>
      <div className="hidden w-64 shrink-0 flex-col gap-3 border-r border-border-subtle bg-surface p-4 md:flex">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 flex flex-col gap-4">
          <Skeleton className="w-32" />
          <Skeleton className="w-36" />
          <Skeleton className="w-28" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 px-4 py-8 md:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="w-80 max-w-full" />
        <Skeleton className="mt-6 h-64 w-full" />
      </div>
    </div>
  );
}
