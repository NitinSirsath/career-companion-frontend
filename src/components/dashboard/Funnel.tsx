import type { CSSProperties } from 'react';
import type { DashboardResponse } from '../../contracts/dashboard';
import { RATE_BASE, barPercent, countOf, rateText, replyDaysText } from '../../lib/dashboard';
import { DashCard } from './DashCard';

/**
 * Applications sent in the period, by the furthest step they reached: columns when the card is
 * wide, bars when it is narrow (the step names need the room). Then the rates and the usual wait.
 */
export function Funnel({ numbers }: { numbers: DashboardResponse }) {
  const f = numbers.funnel;
  const few = f.applied < RATE_BASE;
  const steps = [
    { label: 'Applied', count: f.applied },
    { label: 'Got a reply', count: f.answered },
    { label: 'Recruiter contact', count: f.recruiterContact },
    { label: 'Assessment', count: f.assessment },
    { label: 'Interview', count: f.interview },
    { label: 'Offer', count: f.offer },
  ];
  const facts = few
    ? []
    : [
        { label: 'Response rate', value: rateText(numbers.rates.response) },
        { label: 'Interview rate', value: rateText(numbers.rates.interview) },
        { label: 'Offer rate', value: rateText(numbers.rates.offer) },
      ];
  if (numbers.usualReplyDays !== null)
    facts.push({ label: 'Usual reply time', value: replyDaysText(numbers.usualReplyDays) });
  return (
    <DashCard
      className="@container/funnel"
      title="From applied to offer"
      aside={few ? `Rates show from ${RATE_BASE} applications` : 'Furthest step each job reached'}
    >
      <ol className="mt-4 flex flex-col gap-2.5 @min-[460px]/funnel:mt-5 @min-[460px]/funnel:flex-row @min-[460px]/funnel:gap-0">
        {steps.map((step, i) => {
          const share = i && !few ? rateText({ count: step.count, of: f.applied }) : null;
          const count = few ? countOf(step.count, f.applied) : step.count;
          const style = {
            '--share': step.count ? Math.max(1, barPercent(step.count, f.applied)) : 0,
          } as CSSProperties;
          return (
            <li
              key={step.label}
              className="grid grid-cols-[104px_minmax(0,1fr)_72px] items-center gap-3 @min-[460px]/funnel:flex @min-[460px]/funnel:min-w-0 @min-[460px]/funnel:flex-1 @min-[460px]/funnel:flex-col @min-[460px]/funnel:items-stretch @min-[460px]/funnel:gap-0 @min-[460px]/funnel:text-center"
            >
              <span className="text-xs @min-[460px]/funnel:order-2 @min-[460px]/funnel:mt-2.5 @min-[460px]/funnel:px-1">
                {step.label}
              </span>
              <span
                style={style}
                className="flex h-4 @min-[460px]/funnel:order-1 @min-[460px]/funnel:h-40 @min-[460px]/funnel:flex-col @min-[460px]/funnel:items-center @min-[460px]/funnel:justify-end @min-[460px]/funnel:border-b @min-[460px]/funnel:border-border-default"
                aria-hidden
              >
                <span className="mb-1.5 hidden text-sm font-medium @min-[460px]/funnel:block">
                  {count}
                </span>
                <span className="h-full w-[calc(var(--share)*1%)] shrink-0 bg-chart-1 @min-[460px]/funnel:h-[calc(var(--share)*0.8%)] @min-[460px]/funnel:w-6" />
              </span>
              <span className="text-right text-xs tabular-nums @min-[460px]/funnel:order-3 @min-[460px]/funnel:text-center">
                <span className="@min-[460px]/funnel:sr-only">{count}</span>
                {share && (
                  <span className="ml-1 text-text-secondary @min-[460px]/funnel:ml-0">{share}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {facts.length > 0 && (
        <dl className="-mx-4 mt-5 -mb-4 grid grid-cols-2 gap-0.5 bg-background pt-0.5 md:-mx-6 md:-mb-6 @min-[560px]/funnel:grid-cols-4">
          {facts.map((fact) => (
            <div key={fact.label} className="bg-surface-subtle px-4 py-3 md:py-4">
              <dt className="text-xs text-text-secondary">{fact.label}</dt>
              <dd className="text-2xl leading-8 font-light">{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </DashCard>
  );
}
