import * as React from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  /** One line under the title. */
  description?: React.ReactNode;
  /** Detail pages only: where the page sits, built with `Breadcrumb`. */
  breadcrumb?: React.ReactNode;
  /** Buttons on the right: at most one primary. */
  actions?: React.ReactNode;
  /** A line of facts under the title, such as company and role. */
  meta?: React.ReactNode;
  className?: string;
}

/** The one page header: breadcrumb, title, one line of description, actions on the right. */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-6 flex flex-col gap-2', className)}>
      {breadcrumb}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-[28px] leading-9 font-normal break-words">{title}</h1>
          {description && <p className="text-sm text-text-secondary">{description}</p>}
          {meta}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * "Mails / Lumen Apps": links back up, then (optionally) this page's own short name.
 */
export function Breadcrumb({ children, current }: { children: React.ReactNode; current?: string }) {
  const links = React.Children.toArray(children);
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {links.map((link, index) => (
          <li key={index} className="flex items-center gap-2 [&_a]:text-link">
            {link}
            {(current || index < links.length - 1) && (
              <span aria-hidden="true" className="text-text-secondary">
                /
              </span>
            )}
          </li>
        ))}
        {current && (
          <li aria-current="page" className="min-w-0 truncate text-text-primary">
            {current}
          </li>
        )}
      </ol>
    </nav>
  );
}
