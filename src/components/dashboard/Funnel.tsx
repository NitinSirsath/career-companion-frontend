import type { DashboardResponse } from '../../contracts/dashboard';
import { RATE_BASE, barPercent, countOf, rateText } from '../../lib/dashboard';
import { DashCard, ShareBar } from './DashCard';

/** Applications sent in the period, by the furthest step they reached, with the three rates. */
export function Funnel({ numbers }: { numbers: DashboardResponse }) {
  const f = numbers.funnel;
  const few = f.applied < RATE_BASE;
  const rows = [
    { label: 'Applied', count: f.applied },
    { label: 'Got a reply', count: f.answered },
    { label: 'Recruiter contact', count: f.recruiterContact },
    { label: 'Assessment', count: f.assessment },
    { label: 'Interview', count: f.interview },
    { label: 'Offer', count: f.offer },
  ];
  const rates = [
    { label: 'Response rate', rate: numbers.rates.response },
    { label: 'Interview rate', rate: numbers.rates.interview },
    { label: 'Offer rate', rate: numbers.rates.offer },
  ];
  return (
    <DashCard
      title="From applied to offer"
      aside={few ? `Rates show from ${RATE_BASE} applications` : 'Furthest step each job reached'}
    >
      <ul className="mt-4 flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <li
            key={row.label}
            className="grid grid-cols-[104px_minmax(0,1fr)_80px] items-center gap-3 md:grid-cols-[150px_minmax(0,1fr)_110px] md:gap-4"
          >
            <span className="text-sm">{row.label}</span>
            <div className="h-6 bg-chart-track" aria-hidden>
              <div
                className="h-full bg-chart-1"
                style={{
                  width: `${row.count ? Math.max(2, barPercent(row.count, f.applied)) : 0}%`,
                }}
              />
            </div>
            <span className="text-right text-sm tabular-nums">
              {few ? countOf(row.count, f.applied) : row.count}
              {!few && i > 0 && (
                <span className="ml-1.5 text-xs text-text-secondary">
                  {rateText({ count: row.count, of: f.applied })}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {!few && (
        <dl className="-mx-4 mt-5 -mb-4 grid grid-cols-3 border-t border-border-subtle md:-mx-6 md:-mb-6">
          {rates.map(({ label, rate }) => (
            <div
              key={label}
              className="border-l border-border-subtle px-4 py-3 first:border-l-0 md:px-6 md:py-4"
            >
              <dt className="text-xs text-text-secondary">{label}</dt>
              <dd className="text-2xl leading-8 font-light">{rateText(rate)}</dd>
            </div>
          ))}
        </dl>
      )}
    </DashCard>
  );
}

/** Rejections in the period, by the step the job had reached: the CV or the interviews? */
export function RejectedAfter({ rejected }: { rejected: DashboardResponse['rejectedAfter'] }) {
  const rows = [
    { label: 'Before any reply', count: rejected.noAnswer },
    { label: 'After recruiter contact', count: rejected.recruiterContact },
    { label: 'After an assessment', count: rejected.assessment },
    { label: 'After an interview', count: rejected.interview },
  ];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <DashCard
      title="Where rejected jobs ended"
      aside={total ? `${total} ${total === 1 ? 'rejection' : 'rejections'}` : undefined}
    >
      {total === 0 ? (
        <p className="mt-3 text-xs text-text-secondary">No rejections in this period.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.label} className="flex flex-col gap-1.5">
              <span className="flex justify-between gap-3 text-sm">
                {row.label}
                <span className="font-mono">{row.count}</span>
              </span>
              <ShareBar percent={barPercent(row.count, max)} color="bg-chart-5" />
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}
