import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  title: string;
  /** Why it is empty, in one sentence. */
  children?: React.ReactNode;
  /** The one next step: a button or a link drawn with `EMPTY_ACTION`. */
  action?: React.ReactNode;
  /** A thin picture that names the list, such as the mail icon on Job mails. */
  icon?: LucideIcon;
  className?: string;
}

/** The next step's look: a round filled button, pressed in a little when tapped. */
export const EMPTY_ACTION =
  'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-action-primary px-5 text-[15px] font-medium text-on-accent no-underline transition-[scale,background-color] duration-200 ease-spring hover:bg-action-primary-hover active:scale-95 active:duration-70 md:h-9 md:text-[13px]';

/** A quieter next step, such as "Clear filters": dark words on a soft grey pill. */
export const EMPTY_ACTION_QUIET =
  'inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-surface-subtle px-5 text-[15px] font-medium text-link no-underline transition-[scale,background-color] duration-200 ease-spring hover:bg-layer-hover active:scale-95 active:duration-70 md:h-9 md:text-[13px]';

/**
 * "Nothing here", drawn as a phone draws it (15 Nov 2026): a thin picture in a soft circle, a short
 * title, why it is empty, and the one next step, centred. The picture springs in and the words
 * follow it, so the page feels alive instead of blank.
 */
export function EmptyState({ title, children, action, icon: Icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center md:py-14', className)}>
      {Icon && (
        <span
          aria-hidden="true"
          className="mb-4 flex size-14 animate-empty-icon items-center justify-center rounded-full bg-surface-subtle text-text-tertiary md:size-12"
        >
          <Icon size={26} strokeWidth={1.6} />
        </span>
      )}
      <p className="animate-empty-line text-[17px] leading-[22px] font-semibold [animation-delay:60ms] md:text-base">
        {title}
      </p>
      {children && (
        <div className="mt-1.5 max-w-[34ch] animate-empty-line text-[15px] leading-5 text-text-secondary [animation-delay:110ms] md:max-w-[46ch] md:text-sm">
          {children}
        </div>
      )}
      {action && <div className="mt-5 animate-empty-line [animation-delay:160ms]">{action}</div>}
    </div>
  );
}
