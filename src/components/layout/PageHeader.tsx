import * as React from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  /** One line under the title. */
  description?: React.ReactNode;
  /** Detail pages only: where the page sits, built with `Breadcrumb`. It shows in the top bar. */
  breadcrumb?: React.ReactNode;
  /** Buttons on the right: at most one primary. */
  actions?: React.ReactNode;
  /** A line of facts under the title, such as company and role. */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * The one page header: title, one line of description, actions on the right, and a line under
 * it across the content.
 */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        // Reaches out over the page's side and top padding, so its line runs across the content.
        '-mx-4 -mt-6 mb-6 flex flex-col border-b border-border-subtle px-4 py-6 md:-mx-12 md:-mt-8 md:px-12 md:py-10',
        className,
      )}
    >
      {breadcrumb}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2">
          <h1 className="text-[28px] leading-9 font-normal tracking-[-0.01em] break-words">
            {title}
          </h1>
          {description && <p className="max-w-160 text-sm text-text-secondary">{description}</p>}
          {meta}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-4">{actions}</div>}
      </div>
    </header>
  );
}
