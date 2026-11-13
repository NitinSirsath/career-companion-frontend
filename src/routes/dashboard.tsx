import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAIReading } from '../api/aiReading';
import { useDashboard } from '../api/dashboard';
import { useGmailStatus } from '../api/gmail';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { PageHeader } from '../components/layout/PageHeader';
import { useIsPhone } from '../components/layout/useIsPhone';
import { PhoneDashboardTop } from '../components/dashboard/PhoneDashboardTop';
import { DashSection } from '../components/dashboard/DashCard';
import { Funnel } from '../components/dashboard/Funnel';
import { GoneQuiet } from '../components/dashboard/GoneQuiet';
import { Mailbox } from '../components/dashboard/Mailbox';
import { NeedsYouNow } from '../components/dashboard/NeedsYouNow';
import { ProgressNumbers } from '../components/dashboard/ProgressNumbers';
import { RunningTotal } from '../components/dashboard/RunningTotal';
import { WorksBest } from '../components/dashboard/WorksBest';
import {
  DashboardSkeleton,
  NoGmailYet,
  ReadingFirstMails,
} from '../components/dashboard/StartStates';
import { SectionError } from '../components/ui/section-error';
import { Select } from '../components/ui/select';
import type { DashboardPeriod, DashboardResponse } from '../contracts/dashboard';
import {
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  dashboardSearchSchema,
  greeting,
  todayLine,
} from '../lib/dashboard';

export const Route = createFileRoute('/dashboard')({
  errorComponent: RouteErrorPage,
  validateSearch: dashboardSearchSchema,
  component: DashboardPage,
});

/**
 * The home page (owner, 3 Nov 2026): a greeting, what needs the user now, their progress in the
 * period, and their mailbox. The menu still calls it Dashboard.
 */
function DashboardPage() {
  const period = Route.useSearch().period ?? DEFAULT_PERIOD;
  const navigate = useNavigate({ from: Route.fullPath });
  const { user } = Route.useRouteContext();
  const phone = useIsPhone();
  const dashboard = useDashboard(period);
  const gmail = useGmailStatus();
  const reading = useAIReading();
  const numbers = dashboard.data;
  const hasData = !!numbers?.dataStartsAt;
  const noGmail = gmail.data?.connected === false && !hasData;
  const firstRead = reading.data?.state === 'READING' && !numbers?.mailbox.jobMails.total;
  const setPeriod = (next: DashboardPeriod) =>
    void navigate({ search: next === DEFAULT_PERIOD ? {} : { period: next }, replace: true });

  return (
    <div className="space-y-6">
      {phone ? (
        <PhoneDashboardTop
          greeting={greeting(user?.name)}
          today={todayLine(numbers?.dataStartsAt ?? null)}
        />
      ) : (
        <PageHeader
          title={greeting(user?.name)}
          description={todayLine(numbers?.dataStartsAt ?? null)}
        />
      )}
      {noGmail && <NoGmailYet status={gmail.data?.status} />}
      {!noGmail && firstRead && reading.data && <ReadingFirstMails reading={reading.data} />}
      {!noGmail && !firstRead && dashboard.isPending && <DashboardSkeleton />}
      {!noGmail && dashboard.isError && !numbers && (
        <SectionError
          title="Could not load your numbers"
          onRetry={() => void dashboard.refetch()}
        />
      )}
      {!noGmail && !firstRead && numbers && (
        <DashboardBody numbers={numbers} period={period} onPeriodChange={setPeriod} />
      )}
    </div>
  );
}

function DashboardBody({
  numbers,
  period,
  onPeriodChange,
}: {
  numbers: DashboardResponse;
  period: DashboardPeriod;
  onPeriodChange: (period: DashboardPeriod) => void;
}) {
  const picker = (
    <Select<DashboardPeriod>
      label="Period"
      hideLabel
      options={PERIOD_OPTIONS}
      value={period}
      onValueChange={onPeriodChange}
      className="w-52 md:w-60"
    />
  );
  // The layout follows the page's own width, so it fits with the side menu open or closed.
  return (
    <div className="@container flex flex-col gap-8 @min-[600px]:gap-14">
      <DashSection title="Needs you now">
        <NeedsYouNow now={numbers.now} />
      </DashSection>
      <DashSection title="Your progress" aside={picker}>
        <div className="flex flex-col gap-2">
          <ProgressNumbers numbers={numbers} />
          <RunningTotal series={numbers.series} />
          <div className="grid items-start gap-2 @min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Funnel numbers={numbers} />
            <GoneQuiet quiet={numbers.goneQuiet} />
          </div>
        </div>
      </DashSection>
      <DashSection title="Your mailbox">
        <Mailbox mailbox={numbers.mailbox} series={numbers.series} period={period} />
      </DashSection>
      {numbers.automation.used && <WorksBest automation={numbers.automation} />}
    </div>
  );
}
