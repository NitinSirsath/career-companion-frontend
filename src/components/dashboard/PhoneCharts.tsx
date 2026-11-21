import { Link } from '@tanstack/react-router';
import type { DashboardPeriod, DashboardResponse } from '../../contracts/dashboard';
import {
  NOT_ENOUGH,
  coverageParts,
  enoughToCompare,
  jobMailsTitle,
  lookedAtText,
  mailboxStats,
  rateLine,
  seriesSpan,
  siteName,
  workModeName,
} from '../../lib/dashboard';
import { JobMailsChart } from './Mailbox';
import { PhoneSection, PhoneStatRow, PhoneSubheading } from './PhoneSection';
import { RunningTotalChart } from './RunningTotal';

type Automation = DashboardResponse['automation'];

/** "Over time" on the page: the running totals, each line named at its end. */
export function PhoneOverTime({ series }: { series: DashboardResponse['series'] }) {
  return (
    <PhoneSection title="Over time" aside={seriesSpan(series.points)}>
      <div className="px-[18px] pt-1">
        <RunningTotalChart series={series} narrow />
      </div>
    </PhoneSection>
  );
}

/** "Your mailbox": its four numbers as rows, then the job mails of the period by kind. */
export function PhoneMailbox({
  numbers,
  period,
}: {
  numbers: DashboardResponse;
  period: DashboardPeriod;
}) {
  const { mailbox, series } = numbers;
  return (
    <>
      <PhoneSection title="Your mailbox">
        {mailboxStats(mailbox, period).map((stat) => (
          <PhoneStatRow
            key={stat.label}
            strong
            label={stat.label}
            line={stat.line}
            value={stat.value.toLocaleString('en-US')}
            link={stat.link ? { to: '/mails', search: { application: 'none' } } : undefined}
          />
        ))}
      </PhoneSection>
      <PhoneSection title={jobMailsTitle(series)} aside={seriesSpan(series.points)}>
        <div className="px-[18px] pt-1">
          <JobMailsChart series={series} narrow />
        </div>
      </PhoneSection>
    </>
  );
}

const sentText = (sent: number) => `${sent} sent`;

/** The sites and ways of working, as rows: how many were sent and how many got a reply. */
function PhoneRates({ automation }: { automation: Automation }) {
  return (
    <>
      <PhoneSubheading>By site</PhoneSubheading>
      {automation.sites.map((site) => {
        const interview = rateLine({ count: site.interviews, of: site.sent }, 'interview');
        return (
          <PhoneStatRow
            key={site.platform ?? 'none'}
            label={siteName(site.platform)}
            line={interview ? `${sentText(site.sent)} · ${interview}` : sentText(site.sent)}
            value={
              rateLine({ count: site.answered, of: site.sent }, 'replied') ?? 'Too few to tell'
            }
          />
        );
      })}
      <PhoneSubheading>Remote, hybrid or on-site</PhoneSubheading>
      {automation.workModes.map((mode) => (
        <PhoneStatRow
          key={mode.workMode ?? 'none'}
          label={workModeName(mode.workMode)}
          line={sentText(mode.sent)}
          value={rateLine({ count: mode.answered, of: mode.sent }, 'replied') ?? 'Too few to tell'}
        />
      ))}
    </>
  );
}

/** What NorthList Apply did: the jobs it looked at, split by what it did, and why it skipped. */
function PhoneCoverage({ automation }: { automation: Automation }) {
  const parts = coverageParts(automation);
  return (
    <>
      <PhoneSubheading>
        What NorthList Apply did
        <Link to="/automation" className="text-[13px] font-normal text-link">
          Open NorthList Apply
        </Link>
      </PhoneSubheading>
      <p className="px-[18px] text-[22px] leading-7 font-bold">
        {lookedAtText(automation.lookedAt)}
      </p>
      {automation.lookedAt > 0 && (
        <div className="mx-[18px] mt-2 flex h-2 gap-0.5 overflow-hidden rounded-[3px]" aria-hidden>
          {parts
            .filter((part) => part.count > 0)
            .map((part) => (
              <div key={part.label} className={part.color} style={{ flexGrow: part.count }} />
            ))}
        </div>
      )}
      <ul className="flex flex-wrap gap-x-3.5 gap-y-1 px-[18px] pt-2 text-[12px] text-text-secondary">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-[2px] ${part.color}`} />
            {part.label} {part.count}
          </li>
        ))}
      </ul>
      {automation.topSkipReasons.length > 0 && (
        <>
          <PhoneSubheading>Why it skipped jobs</PhoneSubheading>
          {automation.topSkipReasons.map((reason) => (
            <PhoneStatRow key={reason.reason} label={reason.reason} value={reason.count} />
          ))}
        </>
      )}
    </>
  );
}

/** "What works best", only for NorthList Apply users (owner, 3 Nov 2026), as plain rows. */
export function PhoneWorksBest({ automation }: { automation: Automation }) {
  return (
    <PhoneSection title="What works best" className="pt-[30px]">
      {enoughToCompare(automation) ? (
        <PhoneRates automation={automation} />
      ) : (
        <p className="px-[18px] text-phone-sub text-text-secondary">{NOT_ENOUGH}</p>
      )}
      <PhoneCoverage automation={automation} />
    </PhoneSection>
  );
}
