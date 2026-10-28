import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** One Dashboard card: a thin line on the page colour, a title, and an aside such as a link. */
export function DashCard({
  title,
  aside,
  note,
  children,
  className,
  flush = false,
  id,
}: {
  id?: string;
  title: string;
  aside?: ReactNode;
  /** One line under the title. */
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  /** For a table that runs to the card's edges. */
  flush?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn('scroll-mt-20 border border-border-subtle', !flush && 'p-4 md:p-6', className)}
    >
      <div className={cn(flush && 'px-4 pt-4 pb-3 md:px-6 md:pt-6')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm leading-5 font-semibold">{title}</h2>
          {aside && <div className="text-xs text-text-secondary">{aside}</div>}
        </div>
        {note && <p className="mt-1 text-xs text-text-secondary">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** A big number with a small label, as the cards show their main fact. */
export function BigNumber({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        'text-[28px] leading-9 font-light tracking-[-0.01em] md:text-[32px] md:leading-10',
        className,
      )}
    >
      {children}
    </p>
  );
}

/** A thin bar for a share, on the chart track colour. */
export function ShareBar({
  percent,
  color = 'bg-chart-1',
  className,
}: {
  percent: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn('h-2 bg-chart-track', className)} aria-hidden>
      <div className={cn('h-full', color)} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

/** The header row of a Dashboard table, as `DataTable` draws it. */
export const TH_CLASS =
  'border-b border-border-default px-4 py-3 text-left font-mono text-[12px] leading-4 font-normal tracking-[0.08em] whitespace-nowrap uppercase md:px-6';
export const TD_CLASS = 'border-b border-border-subtle px-4 py-3 md:px-6';
