import type { DashboardResponse } from '../../contracts/dashboard';
import { changeText, periodWeeks } from '../../lib/dashboard';
import { cn } from '../../lib/utils';
import { Sparkline } from './Sparkline';

const NUMBERS = [
  { key: 'applicationsSent', week: 'applicationsSent', label: 'Applications sent' },
  { key: 'repliesReceived', week: 'replies', label: 'Replies received' },
  { key: 'interviewsReached', week: 'interviews', label: 'Interviews reached' },
  { key: 'offers', week: 'offers', label: 'Offers' },
  { key: 'rejections', week: 'rejections', label: 'Rejections' },
] as const;

/** Phones: two across, the last full width. Tablets: three, then two. Laptops: five. */
const SPAN = [
  '@min-[600px]:col-span-2',
  '@min-[600px]:col-span-2',
  '@min-[600px]:col-span-2',
  '@min-[600px]:col-span-3',
  'col-span-2 @min-[600px]:col-span-3',
];

/** The five numbers of the period, each with the change and its last 12 weeks. */
export function ProgressNumbers({ numbers }: { numbers: DashboardResponse }) {
  const { current, previous } = numbers.totals;
  const highlight = periodWeeks(numbers.period);
  return (
    <dl className="grid grid-cols-2 gap-2 @min-[600px]:grid-cols-6 @min-[900px]:grid-cols-5">
      {NUMBERS.map(({ key, week, label }, i) => (
        <div
          key={key}
          className={cn(
            'flex min-w-0 flex-col gap-1 bg-surface-subtle p-4 @min-[600px]:p-5 @min-[900px]:col-span-1',
            SPAN[i],
          )}
        >
          <dt className="text-xs text-text-secondary">{label}</dt>
          <dd className="flex items-end justify-between gap-2">
            <span className="text-[28px] leading-9 font-light tracking-[-0.01em] @min-[600px]:text-[32px] @min-[600px]:leading-10">
              {current[key]}
            </span>
            <Sparkline
              values={numbers.trend.weeks.map((w) => w[week])}
              highlight={highlight}
              className="mb-1"
            />
          </dd>
          <dd className="text-xs text-text-secondary">
            {changeText(
              current[key],
              previous?.[key] ?? null,
              numbers.period,
              numbers.dataStartsAt,
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
