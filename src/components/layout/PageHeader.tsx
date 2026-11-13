import * as React from 'react';
import { cn } from '../../lib/utils';
import { usePhoneNav } from '../phone/phoneNav';
import { PhoneTitle } from '../phone/PhoneTitle';
import { RefreshButton } from '../ui/refresh-button';

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
  /**
   * List pages: on phones the top bar already names the page, so the title and description are
   * kept for screen readers only and the actions move to the page itself.
   */
  phoneCompact?: boolean;
  /** Phones: keep the actions (a single "…") beside the title instead of on a line of their own. */
  actionsBesideTitle?: boolean;
  /** List pages on laptops: a refresh button before the actions (phones refresh from the top bar). */
  refresh?: boolean;
  className?: string;
}

/**
 * Phones (owner, 13 Nov 2026): the big title (34px on a tab's first page, 28px on a page opened
 * from it), the description under it, then the actions.
 */
function PhoneHeader({
  title,
  description,
  actions,
  meta,
  className,
}: Pick<PageHeaderProps, 'title' | 'description' | 'actions' | 'meta' | 'className'>) {
  const nav = usePhoneNav();
  return (
    <header className={cn('flex flex-col gap-1.5 px-1 pt-0.5 pb-4', className)}>
      <PhoneTitle size={nav?.isRoot ? 'list' : 'detail'}>{title}</PhoneTitle>
      {description && (
        <div className="text-[15px] leading-5 text-text-secondary">{description}</div>
      )}
      {meta}
      {actions && <div className="flex flex-wrap items-center gap-3 pt-2">{actions}</div>}
    </header>
  );
}

/**
 * The one page header: title, one line of description, actions on the right, and a line under
 * it across the content. Phones have their own (`PhoneHeader`).
 */
export function PageHeader(props: PageHeaderProps) {
  const phone = !!usePhoneNav();
  if (!phone || props.phoneCompact) return <LaptopHeader {...props} />;
  return (
    <>
      {props.breadcrumb}
      <PhoneHeader {...props} />
    </>
  );
}

function LaptopHeader({
  title,
  description,
  breadcrumb,
  actions,
  meta,
  phoneCompact = false,
  actionsBesideTitle = false,
  refresh = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        // Reaches out over the page's side and top padding, so its line runs across the content.
        '-mx-4 -mt-6 mb-6 flex flex-col border-b border-border-subtle px-4 py-6 md:-mx-12 md:-mt-8 md:px-12 md:py-10',
        className,
        phoneCompact && 'max-md:m-0 max-md:border-0 max-md:p-0',
      )}
    >
      {breadcrumb}
      <div
        className={cn(
          'flex flex-wrap items-start justify-between gap-x-6 gap-y-4',
          actionsBesideTitle && 'max-md:flex-nowrap max-md:gap-x-2',
        )}
      >
        <div
          className={cn(
            'flex min-w-0 flex-1 basis-80 flex-col gap-2',
            phoneCompact && 'max-md:sr-only',
            actionsBesideTitle && 'max-md:basis-0',
          )}
        >
          <h1 className="text-[22px] leading-7 font-semibold tracking-[-0.025em] break-words md:text-[26px] md:leading-8">
            {title}
          </h1>
          {description && <p className="max-w-160 text-sm text-text-secondary">{description}</p>}
          {meta}
        </div>
        {(actions || refresh) && (
          <div
            className={cn(
              'flex flex-wrap items-center gap-4',
              phoneCompact && 'max-md:hidden',
              actionsBesideTitle && 'max-md:-mr-2',
            )}
          >
            {refresh && <RefreshButton />}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
