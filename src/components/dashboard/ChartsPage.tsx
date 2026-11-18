import { useEffect, useRef } from 'react';
import { Navigate, useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import type { DashboardPeriod } from '../../contracts/dashboard';
import { choosePeriod, useChosenPeriod } from '../../lib/dashboardPeriod';
import { useDashboard } from '../../api/dashboard';
import { useIsPhone } from '../layout/useIsPhone';
import { PhoneTitle } from '../phone/PhoneTitle';
import { SectionError } from '../ui/section-error';
import { Select } from '../ui/select';
import { DEFAULT_PERIOD, PERIOD_OPTIONS, shortDate } from '../../lib/dashboard';
import { DashSection } from './DashCard';
import { Funnel } from './Funnel';
import { GoneQuiet } from './GoneQuiet';
import { Mailbox } from './Mailbox';
import { ProgressNumbers } from './ProgressNumbers';
import { RunningTotal } from './RunningTotal';
import { DashboardSkeleton } from './StartStates';
import { WorksBest } from './WorksBest';

/** The quiet jobs' place on the page, which Today's "Gone quiet" opens. */
const GONE_QUIET = 'gone-quiet';

/**
 * "Charts and rates" (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 7): on phones, Today's
 * charts one tap deeper, with the period picker (Today follows it): the numbers with their change, the
 * running total, the funnel, the jobs gone quiet, the mailbox, and what works best. Laptops show
 * all of it on the Dashboard itself.
 */
export function ChartsPage() {
  const search = useSearch({ from: '/dashboard_/charts' });
  const navigate = useNavigate({ from: '/dashboard/charts' });
  const chosen = useChosenPeriod();
  const period = search.period ?? chosen ?? DEFAULT_PERIOD;
  const phone = useIsPhone();
  const dashboard = useDashboard(period);
  const numbers = dashboard.data;
  const hash = useLocation({ select: (location) => location.hash });
  const quiet = useRef<HTMLDivElement>(null);
  const loaded = !!numbers;
  // "Gone quiet" on Today opens this page at the list of quiet jobs.
  useEffect(() => {
    if (loaded && hash === GONE_QUIET) quiet.current?.scrollIntoView({ block: 'start' });
  }, [loaded, hash]);
  if (!phone) return <Navigate to="/dashboard" search={search} replace />;
  const setPeriod = (next: DashboardPeriod) => {
    choosePeriod(next);
    void navigate({ search: { period: next }, hash, replace: true });
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-[3px] px-0.5">
        <PhoneTitle size="detail">Charts and rates</PhoneTitle>
        {numbers?.dataStartsAt && (
          <p className="text-phone-sub text-text-secondary">
            From your mails since {shortDate(numbers.dataStartsAt)}
          </p>
        )}
      </div>
      <Select<DashboardPeriod>
        label="Period"
        hideLabel
        options={PERIOD_OPTIONS}
        value={period}
        onValueChange={setPeriod}
        className="w-60"
      />
      {dashboard.isPending && <DashboardSkeleton />}
      {dashboard.isError && !numbers && (
        <SectionError
          title="Could not load your numbers"
          onRetry={() => void dashboard.refetch()}
        />
      )}
      {numbers && (
        <div className="@container flex flex-col gap-8">
          <DashSection title="Your progress">
            <div className="flex flex-col gap-2">
              <ProgressNumbers numbers={numbers} />
              <RunningTotal series={numbers.series} />
              <Funnel numbers={numbers} />
              <div id={GONE_QUIET} ref={quiet} className="scroll-mt-28">
                <GoneQuiet quiet={numbers.goneQuiet} />
              </div>
            </div>
          </DashSection>
          <DashSection title="Your mailbox">
            <Mailbox mailbox={numbers.mailbox} series={numbers.series} period={period} />
          </DashSection>
          {numbers.automation.used && <WorksBest automation={numbers.automation} />}
        </div>
      )}
    </div>
  );
}
