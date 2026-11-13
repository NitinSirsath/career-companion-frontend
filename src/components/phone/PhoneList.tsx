import { useId, type ReactNode } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/** A row's look: at least 50px, 17px text, darker while pressed. */
export const PHONE_ROW =
  'flex min-h-[50px] w-full items-center gap-3 px-4 py-[11px] text-left text-[17px] leading-[22px] text-text-primary transition-colors duration-450 active:bg-surface-selected active:duration-0';

/**
 * Rows on one soft grey group with thin lines between them (owner, 13 Nov 2026): the phone's
 * grouped lists, 16px corners. `icons`: the lines start after the rows' icons.
 */
export function PhoneGroup({
  icons = false,
  className,
  children,
}: {
  icons?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grouped-rows overflow-hidden rounded-2xl bg-surface-subtle empty:hidden',
        icons && '[--row-inset:58px]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * A section of a phone page: a short title with a grey count, its group, and its help as a small
 * note under it.
 */
export function PhoneSection({
  title,
  count,
  action,
  note,
  className,
  children,
}: {
  title?: string;
  count?: ReactNode;
  /** A small link at the right of the title, such as "Last 30 days". */
  action?: ReactNode;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className={cn('mt-[26px]', className)}>
      {title && (
        <div className="flex items-baseline gap-2 px-1 pb-2">
          <h2 id={id} className="text-[17px] leading-[22px] font-semibold">
            {title}
          </h2>
          {count !== undefined && <span className="text-[15px] text-text-tertiary">{count}</span>}
          {action && <span className="ml-auto text-[15px]">{action}</span>}
        </div>
      )}
      {children}
      {note && (
        <p className="px-4 pt-[7px] text-[13px] leading-[18px] text-text-tertiary">{note}</p>
      )}
    </section>
  );
}

/** A section whose rows sit on one group: the title, the rows, the note. */
export function PhoneGroupSection({
  title,
  count,
  note,
  className,
  children,
}: {
  title: string;
  count?: ReactNode;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <PhoneSection title={title} count={count} note={note} className={className}>
      <PhoneGroup>{children}</PhoneGroup>
    </PhoneSection>
  );
}

/** A coloured square behind a white icon, as iPhone settings rows have. */
export function RowIcon({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-[30px] shrink-0 items-center justify-center rounded-[8px] text-white"
      style={{ backgroundColor: color }}
    >
      {children}
    </span>
  );
}

interface RowParts {
  icon?: ReactNode;
  /** A second line under the label. */
  detail?: ReactNode;
  /** Grey words at the right, such as a time or a state. */
  value?: ReactNode;
  children: ReactNode;
}

function RowInside({ icon, detail, value, children, chevron }: RowParts & { chevron: boolean }) {
  return (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="min-w-0 break-words">{children}</span>
        {detail && <span className="text-[15px] leading-5 text-text-secondary">{detail}</span>}
      </span>
      {value !== undefined && (
        <span className="shrink-0 text-right text-[17px] text-text-secondary">{value}</span>
      )}
      {chevron && (
        <ChevronRightIcon size={18} aria-hidden="true" className="shrink-0 text-text-tertiary" />
      )}
    </>
  );
}

/** A row that opens a page: a chevron at the end. */
export function PhoneLinkRow({ icon, detail, value, children, ...link }: RowParts & LinkProps) {
  return (
    <Link {...link} className={PHONE_ROW}>
      <RowInside icon={icon} detail={detail} value={value} chevron>
        {children}
      </RowInside>
    </Link>
  );
}

/** A row that does something here, or only shows a fact (no `onClick`). */
export function PhoneRow({
  icon,
  detail,
  value,
  children,
  onClick,
  className,
  chevron = false,
}: RowParts & { onClick?: () => void; className?: string; chevron?: boolean }) {
  const inside = (
    <RowInside icon={icon} detail={detail} value={value} chevron={chevron}>
      {children}
    </RowInside>
  );
  if (!onClick)
    return <div className={cn(PHONE_ROW, 'active:bg-transparent', className)}>{inside}</div>;
  return (
    <button type="button" onClick={onClick} className={cn(PHONE_ROW, 'cursor-pointer', className)}>
      {inside}
    </button>
  );
}
