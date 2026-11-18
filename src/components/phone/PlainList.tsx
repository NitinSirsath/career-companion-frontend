import { useId, type ReactNode } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * A plain row's look (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 8, like Linear
 * Settings): at least 50px, edge to edge, a thin line under it, grey while touched.
 */
export const PLAIN_ROW =
  'flex min-h-[50px] w-full items-center gap-3 border-b border-border-subtle px-[18px] text-left text-phone-row text-text-primary transition-colors duration-450 last:border-b-0 active:bg-surface-selected active:duration-0';

/**
 * A section of plain rows (owner, 18 Nov 2026): a small grey label, the rows between two thin
 * lines with no box and no icons, and a grey note under them. It runs to the screen's edges, so
 * put it straight on the page. Replaces the rounded `PhoneGroup`s; pages move over one by one.
 */
export function PlainSection({
  label,
  note,
  className,
  children,
}: {
  label?: string;
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={label ? id : undefined}
      className={cn('phone-bleed mb-[22px]', className)}
    >
      {label && (
        <h2 id={id} className="px-[18px] pb-1.5 text-phone-label text-text-secondary">
          {label}
        </h2>
      )}
      <div className="border-y border-border-subtle">{children}</div>
      {note && <p className="px-[18px] pt-2 text-phone-small text-text-secondary">{note}</p>}
    </section>
  );
}

interface PlainParts {
  /** A grey second line under the label. */
  detail?: ReactNode;
  /** Grey words at the right: a time, a state, a count. */
  value?: ReactNode;
  /** Something at the right instead of words: a switch, a blue tick, a small action. */
  end?: ReactNode;
  children: ReactNode;
}

function Inside({ detail, value, end, children, chevron }: PlainParts & { chevron: boolean }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-col py-2">
        <span className="min-w-0 break-words">{children}</span>
        {detail && <span className="text-phone-sub text-text-secondary">{detail}</span>}
      </span>
      {value !== undefined && (
        <span className="shrink-0 text-right text-[15px] whitespace-nowrap text-text-secondary">
          {value}
        </span>
      )}
      {end}
      {chevron && (
        <ChevronRightIcon size={15} aria-hidden="true" className="-ml-1 shrink-0 text-ring-grey" />
      )}
    </>
  );
}

/** A plain row that opens a page: label, grey value, chevron. */
export function PlainLinkRow({ detail, value, end, children, ...link }: PlainParts & LinkProps) {
  return (
    <Link {...link} className={PLAIN_ROW}>
      <Inside detail={detail} value={value} end={end} chevron>
        {children}
      </Inside>
    </Link>
  );
}

/**
 * A plain row that does something here (`onClick`), or only shows a fact. `tone`: blue for the
 * one main action, red for a risky one (last on the page), centred words for either.
 */
export function PlainRow({
  detail,
  value,
  end,
  children,
  onClick,
  chevron = false,
  tone,
  center = false,
  className,
}: PlainParts & {
  onClick?: () => void;
  chevron?: boolean;
  tone?: 'blue' | 'red';
  center?: boolean;
  className?: string;
}) {
  const look = cn(
    PLAIN_ROW,
    tone === 'blue' && 'text-accent',
    tone === 'red' && 'text-late',
    center && 'justify-center text-center',
    className,
  );
  const inside = (
    <Inside detail={detail} value={value} end={end} chevron={chevron}>
      {children}
    </Inside>
  );
  if (!onClick) return <div className={cn(look, 'active:bg-transparent')}>{inside}</div>;
  return (
    <button type="button" onClick={onClick} className={cn(look, 'cursor-pointer')}>
      {inside}
    </button>
  );
}
