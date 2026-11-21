import type { DashboardPeriod, DashboardResponse } from '../../contracts/dashboard';
import { PERIOD_OPTIONS, PROGRESS_NUMBERS, changeShort, compareText } from '../../lib/dashboard';
import { Select } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { PhoneMailbox, PhoneOverTime, PhoneWorksBest } from './PhoneCharts';
import { PhoneNeedsYou } from './PhoneNeedsYou';
import { PhoneSection } from './PhoneSection';

/** The period's five numbers in one line, each with its change, and what the arrows compare with. */
function PhoneProgress({
  numbers,
  period,
  onPeriodChange,
}: {
  numbers: DashboardResponse;
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}) {
  const { current, previous } = numbers.totals;
  const note = compareText(period);
  return (
    <PhoneSection
      title="Your progress"
      aside={
        <Select<DashboardPeriod>
          label="Period"
          appearance="pill"
          options={PERIOD_OPTIONS}
          value={period}
          onValueChange={onPeriodChange}
        />
      }
    >
      <dl className="grid grid-cols-5 px-[18px] pt-0.5">
        {PROGRESS_NUMBERS.map(({ key, label }) => (
          <div key={key} className="flex min-w-0 flex-col">
            <dt className="order-2 text-[12px] leading-4 font-medium text-text-secondary">
              {label}
            </dt>
            <dd
              key={current[key]}
              className="order-1 animate-count-in text-[24px] leading-8 font-bold tabular-nums"
            >
              {current[key]}
            </dd>
            <dd className="order-3 mt-0.5 text-[12px] leading-4 text-text-tertiary tabular-nums">
              {changeShort(current[key], previous?.[key] ?? null)}
            </dd>
          </div>
        ))}
      </dl>
      {note && <p className="px-[18px] pt-2 text-[12px] leading-4 text-text-tertiary">{note}</p>}
    </PhoneSection>
  );
}

/**
 * The phone's Today below its title (owner, 21 Nov 2026, mock \`DASHBOARD-PHONE-mock/\`): "Needs
 * you" as tiles, then the period's numbers with the period picker, and the charts right on the
 * page: over time, the mailbox, and what works best for NorthList Apply users.
 */
export function PhoneToday({
  numbers,
  period,
  onPeriodChange,
}: {
  numbers: DashboardResponse;
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}) {
  return (
    <div className="-mx-4 pb-2">
      <PhoneNeedsYou now={numbers.now} />
      <PhoneProgress numbers={numbers} period={period} onPeriodChange={onPeriodChange} />
      <PhoneOverTime series={numbers.series} />
      <PhoneMailbox numbers={numbers} period={period} />
      {numbers.automation.used && <PhoneWorksBest automation={numbers.automation} />}
    </div>
  );
}

/** While Today loads on a phone: its tiles' and numbers' shape, not the laptop's (17 Nov 2026). */
export function PhoneTodaySkeleton() {
  return (
    <div className="-mx-4 px-[18px] pt-3" aria-hidden>
      <Skeleton className="h-3.5 w-20 rounded" />
      <div className="grid grid-cols-2 gap-2 pt-2.5">
        <Skeleton className="col-span-2 h-[140px] rounded-2xl" />
        <Skeleton className="h-[118px] rounded-2xl" />
        <Skeleton className="h-[118px] rounded-2xl" />
      </div>
      <div className="grid grid-cols-5 gap-3 pt-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 rounded" />
        ))}
      </div>
    </div>
  );
}
