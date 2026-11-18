import type { ReactNode } from 'react';
import { Link, type LinkProps } from '@tanstack/react-router';
import { ChevronRightIcon, ClockIcon } from 'lucide-react';
import type { DashboardPeriod, DashboardResponse } from '../../contracts/dashboard';
import { PERIOD_OPTIONS } from '../../lib/dashboard';
import { cn } from '../../lib/utils';
import { Ring } from '../ui/ring';
import { Skeleton } from '../ui/skeleton';

/** A short grey heading over a part of Today. */
const HEADING = 'px-[18px] pt-3 pb-1.5 text-phone-label text-text-secondary';
const ROW =
  'flex h-12 items-center gap-[11px] border-b border-border-subtle px-[18px] text-phone-row text-text-primary transition-colors duration-450 active:bg-surface-selected active:duration-0';

/** One "Needs you" row: its mark, its name, the count, and a chevron when it opens a page. */
function NeedRow({
  mark,
  label,
  count,
  link,
}: {
  mark: ReactNode;
  label: string;
  count: number;
  link?: LinkProps;
}) {
  const inside = (
    <>
      <span className="flex w-[15px] shrink-0 justify-center">{mark}</span>
      <span className="flex-1 font-medium">{label}</span>
      <span className="text-[15px] text-text-secondary tabular-nums">{count}</span>
      <ChevronRightIcon
        size={14}
        aria-hidden="true"
        className={cn('shrink-0 text-text-tertiary', !link && 'invisible')}
      />
    </>
  );
  if (!link) return <div className={cn(ROW, 'active:bg-transparent')}>{inside}</div>;
  return (
    <Link {...link} className={ROW}>
      {inside}
    </Link>
  );
}

/**
 * "Needs you" on the phone's Today (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 7): the
 * mails to act on, new job mails, interviews coming up and jobs gone quiet, each with its count.
 */
function NeedsYou({ numbers, period }: { numbers: DashboardResponse; period: DashboardPeriod }) {
  const { now, goneQuiet } = numbers;
  const next = now.interviews.next;
  return (
    <section aria-labelledby="needs-you">
      <h2 id="needs-you" className={HEADING}>
        Needs you
      </h2>
      <NeedRow
        mark={<Ring kind="interview" />}
        label="Needs action"
        count={now.needsAction.count}
        link={{ to: '/mails', search: { request: 'open' } }}
      />
      <NeedRow
        mark={
          now.newJobMails.count > 0 && <span className="size-2 rounded-full bg-action-primary" />
        }
        label="New job mails"
        count={now.newJobMails.count}
        link={{ to: '/mails', search: { unseen: true } }}
      />
      <NeedRow
        mark={<ClockIcon size={16} aria-hidden="true" className="text-text-secondary" />}
        label="Interviews coming up"
        count={now.interviews.count}
        link={next ? { to: '/mails/$key', params: { key: next.conversationKey } } : undefined}
      />
      <NeedRow
        mark={<Ring kind="closed" />}
        label="Gone quiet"
        count={goneQuiet.count}
        link={{ to: '/dashboard/charts', search: { period }, hash: 'gone-quiet' }}
      />
    </section>
  );
}

const NUMBERS = [
  { key: 'applicationsSent', label: 'Applied' },
  { key: 'repliesReceived', label: 'Replies' },
  { key: 'interviewsReached', label: 'Interviews' },
  { key: 'offers', label: 'Offers' },
] as const;

/**
 * The phone's Today below its title (mock screen 7): "Needs you" rows with counts, the period's
 * four numbers in one line, and "Charts and rates" one tap deeper, where every chart stays.
 */
export function PhoneToday({
  numbers,
  period,
}: {
  numbers: DashboardResponse;
  period: DashboardPeriod;
}) {
  const current = numbers.totals.current;
  return (
    <div className="-mx-4">
      <NeedsYou numbers={numbers} period={period} />
      <section aria-label="Your numbers">
        {/* The period is picked on Charts and rates; this heading follows it. */}
        <h2 className={cn(HEADING, 'pt-[22px]')}>
          {PERIOD_OPTIONS.find((option) => option.value === period)?.label}
        </h2>
        <dl className="grid grid-cols-4 px-[18px] pt-1 pb-3.5">
          {NUMBERS.map(({ key, label }) => (
            <div key={key} className="flex flex-col-reverse">
              <dt className="text-[12px] font-medium text-text-secondary">{label}</dt>
              <dd key={current[key]} className="animate-count-in text-[24px] leading-8 font-bold">
                {current[key]}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <Link
        to="/dashboard/charts"
        search={{ period }}
        className={cn(ROW, 'border-t text-text-secondary')}
      >
        <span className="flex-1">Charts and rates</span>
        <ChevronRightIcon size={14} aria-hidden="true" className="shrink-0 text-text-tertiary" />
      </Link>
    </div>
  );
}

/** While Today loads on a phone: its rows' shape, not the laptop's tiles (owner, 17 Nov 2026). */
export function PhoneTodaySkeleton() {
  return (
    <div className="-mx-4 pt-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex h-12 items-center gap-[11px] px-[18px]">
          <Skeleton className="size-[15px] rounded-full" />
          <Skeleton className="h-3.5 w-40 rounded" />
        </div>
      ))}
      <div className="grid grid-cols-4 gap-4 px-[18px] pt-8">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 rounded" />
        ))}
      </div>
    </div>
  );
}
