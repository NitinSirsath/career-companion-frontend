import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/** One part of the Dashboard: a title, something on its right such as the period, and its cards. */
export function DashSection({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-3">
        <h2
          id={id}
          className="text-lg leading-6 font-semibold tracking-[-0.01em] @min-[600px]:text-xl @min-[600px]:leading-7"
        >
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * One Dashboard card: a soft grey panel with no outline (the Calm look, owner, 3 Nov 2026), a
 * title, and an aside such as a link.
 */
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
      className={cn(
        'scroll-mt-20 overflow-hidden rounded-lg bg-surface-subtle',
        !flush && 'p-4 md:p-6',
        className,
      )}
    >
      <div className={cn(flush && 'px-4 pt-4 pb-3 md:px-6 md:pt-6')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-sm leading-5 font-semibold">{title}</h3>
          {aside && <div className="text-xs text-text-secondary">{aside}</div>}
        </div>
        {note && <p className="mt-1 text-xs text-text-secondary">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** A thin bar for a share, on the page colour of the grey card. */
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
    <div className={cn('h-2 bg-background', className)} aria-hidden>
      <div className={cn('h-full', color)} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

/** The header row of a Dashboard table; lines in a grey card are the page colour. */
export const TH_CLASS =
  'border-b-2 border-background px-4 py-3 text-left text-[13px] leading-4 font-medium whitespace-nowrap text-text-secondary md:px-6';
export const TD_CLASS = 'border-b-2 border-background px-4 py-3 md:px-6';

/** A chart's numbers as a table for screen readers. The wrapper keeps the table out of the layout. */
export function ChartTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])}>
              {row.map((cell, i) => (
                <td key={head[i]}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
