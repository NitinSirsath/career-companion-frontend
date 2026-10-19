import * as React from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  title: string;
  /** Why it is empty, in one sentence. */
  children?: React.ReactNode;
  /** The one next step. */
  action?: React.ReactNode;
  className?: string;
}

/** "Nothing here": says why, and offers the next step. */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex animate-fade-in flex-col items-start gap-2 py-10', className)}>
      <p className="text-xl leading-7">{title}</p>
      {children && <div className="text-sm text-text-secondary">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
