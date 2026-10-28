import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useAIReading } from '../api/aiReading';
import { useDashboard } from '../api/dashboard';
import { useGmailStatus } from '../api/gmail';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { PageHeader } from '../components/layout/PageHeader';
import { DataLine, RightNow, TotalsStrip } from '../components/dashboard/Overview';
import { Funnel, RejectedAfter } from '../components/dashboard/Funnel';
import { WeekByWeek } from '../components/dashboard/WeekByWeek';
import { AnswerSpeed, GoneQuiet, KeepingUp, KeptSafe } from '../components/dashboard/Progress';
import { WorksBest } from '../components/dashboard/WorksBest';
import { Tips } from '../components/dashboard/Tips';
import {
  DashboardSkeleton,
  NoGmailYet,
  ReadingFirstMails,
} from '../components/dashboard/StartStates';
import { SectionError } from '../components/ui/section-error';
import { Select } from '../components/ui/select';
import type { DashboardPeriod, DashboardResponse } from '../contracts/dashboard';
import { DEFAULT_PERIOD, PERIOD_OPTIONS, dashboardSearchSchema, longDate } from '../lib/dashboard';

export const Route = createFileRoute('/dashboard')({
  errorComponent: RouteErrorPage,
  validateSearch: dashboardSearchSchema,
  component: DashboardPage,
});

function DashboardPage() {
  const period = Route.useSearch().period ?? DEFAULT_PERIOD;
  const navigate = useNavigate({ from: Route.fullPath });
  const dashboard = useDashboard(period);
  const gmail = useGmailStatus();
  const reading = useAIReading();
  const numbers = dashboard.data;
  const hasData = !!numbers?.dataStartsAt;
  const noGmail = gmail.data?.connected === false && !hasData;
  const firstRead = reading.data?.state === 'READING' && !numbers?.data.jobMailsRead;

  const picker = !noGmail && (
    <Select<DashboardPeriod>
      label="Period"
      hideLabel
      options={PERIOD_OPTIONS}
      value={period}
      onValueChange={(next) =>
        void navigate({ search: next === DEFAULT_PERIOD ? {} : { period: next }, replace: true })
      }
      className="w-full md:w-60"
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        phoneCompact
        description={
          numbers?.dataStartsAt
            ? `Your job search in numbers, from your mails since ${longDate(numbers.dataStartsAt)}.`
            : 'Your job search in numbers, from your mails.'
        }
        actions={picker}
      />
      <div className="md:hidden">{picker}</div>
      {noGmail && <NoGmailYet status={gmail.data?.status} />}
      {!noGmail && firstRead && reading.data && <ReadingFirstMails reading={reading.data} />}
      {!noGmail && !firstRead && dashboard.isPending && <DashboardSkeleton />}
      {!noGmail && dashboard.isError && !numbers && (
        <SectionError
          title="Could not load your numbers"
          onRetry={() => void dashboard.refetch()}
        />
      )}
      {!noGmail && !firstRead && numbers && <DashboardBody numbers={numbers} />}
    </div>
  );
}

function DashboardBody({ numbers }: { numbers: DashboardResponse }) {
  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <DataLine data={numbers.data} />
      <Tips tips={numbers.tips} aiTip={numbers.aiTip} />
      <TotalsStrip numbers={numbers} />
      <RightNow rightNow={numbers.rightNow} />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Funnel numbers={numbers} />
        <RejectedAfter rejected={numbers.rejectedAfter} />
      </div>
      <WeekByWeek weeks={numbers.weeks} />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <GoneQuiet quiet={numbers.goneQuiet} />
        <AnswerSpeed speed={numbers.answerSpeed} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <KeepingUp keeping={numbers.keepingUp} />
        <KeptSafe fakeOffers={numbers.data.fakeOffers} />
      </div>
      <WorksBest automation={numbers.automation} />
    </div>
  );
}
