import { useId, type ReactNode } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/** A short grey heading over a part of the phone's Today. */
export const PHONE_HEADING = 'text-phone-label text-text-secondary';

/**
 * One part of Today on phones (owner, 21 Nov 2026, mock `DASHBOARD-PHONE-mock/`): a grey heading,
 * something on its right such as the dates or the period, and the part drawn flat on the page.
 */
export function PhoneSection({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('pt-[22px]', className)}>
      <div className="flex min-h-7 items-center justify-between gap-3 px-[18px] pb-1.5">
        <h2 id={id} className={PHONE_HEADING}>
          {title}
        </h2>
        {typeof aside === 'string' ? (
          <span className="text-[12px] text-text-tertiary">{aside}</span>
        ) : (
          aside
        )}
      </div>
      {children}
    </section>
  );
}

/** A smaller heading inside a part, as "By site". */
export function PhoneSubheading({ children }: { children: ReactNode }) {
  return (
    <h3 className="flex min-h-7 items-center justify-between gap-3 px-[18px] pt-3 pb-1.5 text-[13px] leading-[18px] font-medium text-text-secondary">
      {children}
    </h3>
  );
}

const ROW =
  'flex min-h-12 items-center gap-[11px] border-b border-border-subtle px-[18px] py-[9px] text-phone-row text-text-primary';

/** A plain row: a name with an optional grey line under it, a value on the right. */
export function PhoneStatRow({
  label,
  line,
  value,
  link,
  strong = false,
}: {
  label: ReactNode;
  line?: ReactNode;
  value: ReactNode;
  link?: LinkProps;
  /** A big number on the right, as in the mailbox, rather than grey words. */
  strong?: boolean;
}) {
  const inside = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {line && (
          <span className={cn('block text-phone-sub', link ? 'text-link' : 'text-text-secondary')}>
            {line}
          </span>
        )}
      </span>
      <span
        className={cn(
          'shrink-0 text-right tabular-nums',
          strong ? 'text-[15px] font-semibold' : 'text-[15px] text-text-secondary',
        )}
      >
        {value}
      </span>
      <ChevronRightIcon
        size={14}
        aria-hidden="true"
        className={cn('shrink-0 text-text-tertiary', !link && 'invisible')}
      />
    </>
  );
  if (!link) return <div className={ROW}>{inside}</div>;
  return (
    <Link
      {...link}
      className={cn(
        ROW,
        'transition-colors duration-450 active:bg-surface-selected active:duration-0',
      )}
    >
      {inside}
    </Link>
  );
}
