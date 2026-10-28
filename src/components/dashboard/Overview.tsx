import { Link } from '@tanstack/react-router';
import type { DashboardResponse } from '../../contracts/dashboard';
import { STATUS_LABEL } from '../../lib/statusLabels';
import { ACTIVE_STEPS, changeText, stepTab } from '../../lib/dashboard';
import { cn } from '../../lib/utils';
import { DashCard } from './DashCard';

/** The data line: what the numbers rest on, each part leading to where it can be fixed. */
export function DataLine({ data }: { data: DashboardResponse['data'] }) {
  const parts = [
    { key: 'read', text: `${data.jobMailsRead} job mails read`, to: '/mails' as const, search: {} },
    data.notLinked > 0 && {
      key: 'unlinked',
      text: `${data.notLinked} not linked to a job`,
      to: '/mails' as const,
      search: { application: 'none' as const },
    },
    data.waitingForAI > 0 && {
      key: 'waiting',
      text: `${data.waitingForAI} still being read`,
      to: '/gmail' as const,
      search: {},
    },
  ].filter((part) => !!part);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
      {parts.map((part, i) => (
        <span key={part.key} className="flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden className="text-text-tertiary">
              ·
            </span>
          )}
          <Link to={part.to} search={part.search} className="text-link hover:underline">
            {part.text}
          </Link>
        </span>
      ))}
      {data.fakeOffers > 0 && (
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-text-tertiary">
            ·
          </span>
          {data.fakeOffers} fake {data.fakeOffers === 1 ? 'offer' : 'offers'} caught
        </span>
      )}
    </p>
  );
}

const TOTALS = [
  { key: 'applicationsSent', label: 'Applications sent' },
  { key: 'repliesReceived', label: 'Replies received' },
  { key: 'interviewsReached', label: 'Interviews reached' },
  { key: 'offers', label: 'Offers' },
  { key: 'rejections', label: 'Rejections' },
] as const;

/** Five numbers for the period, each with the change against the period before. */
export function TotalsStrip({ numbers }: { numbers: DashboardResponse }) {
  const { current, previous } = numbers.totals;
  return (
    <dl className="grid grid-cols-2 border-t border-l border-border-subtle md:grid-cols-3 xl:grid-cols-5">
      {TOTALS.map(({ key, label }, i) => (
        <div
          key={key}
          className={cn(
            'flex flex-col gap-1 border-r border-b border-border-subtle p-4 md:px-6 md:py-5',
            i === TOTALS.length - 1 && 'max-md:col-span-2',
          )}
        >
          <dt className="text-xs text-text-secondary">{label}</dt>
          <dd className="text-[32px] leading-10 font-light tracking-[-0.01em]">{current[key]}</dd>
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

const STEP_COLOR: Record<(typeof ACTIVE_STEPS)[number], string> = {
  APPLIED: 'bg-chart-4',
  RECRUITER_CONTACT: 'bg-tag-cyan',
  ASSESSMENT: 'bg-chart-2',
  INTERVIEW: 'bg-chart-1',
  OFFER: 'bg-ok',
};

/** Active jobs by step right now, whatever the period. Each step opens its Applications tab. */
export function RightNow({ rightNow }: { rightNow: DashboardResponse['rightNow'] }) {
  const total = ACTIVE_STEPS.reduce((sum, step) => sum + rightNow[step], 0);
  return (
    <DashCard
      title={`Right now: ${total} active ${total === 1 ? 'job' : 'jobs'}`}
      aside={
        <Link to="/applications" className="text-link hover:underline">
          Open Applications
        </Link>
      }
    >
      <div className="my-4 flex h-3 gap-0.5 bg-chart-track md:mt-5" aria-hidden>
        {ACTIVE_STEPS.filter((step) => rightNow[step] > 0).map((step) => (
          <div key={step} className={STEP_COLOR[step]} style={{ flexGrow: rightNow[step] }} />
        ))}
      </div>
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(128px,1fr))] gap-3">
        {ACTIVE_STEPS.map((step) => (
          <li key={step}>
            <Link
              to="/applications"
              search={{ status: stepTab(step) }}
              className="flex flex-col gap-1 hover:underline"
            >
              <span className="flex items-center gap-2 text-xs whitespace-nowrap text-text-secondary">
                <span aria-hidden className={cn('size-2 rounded-full', STEP_COLOR[step])} />
                {STATUS_LABEL[step]}
              </span>
              <span className="text-xl leading-7">{rightNow[step]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DashCard>
  );
}
