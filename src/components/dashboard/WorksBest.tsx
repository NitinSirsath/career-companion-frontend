import { Link } from '@tanstack/react-router';
import type { DashboardResponse } from '../../contracts/dashboard';
import { RATE_BASE, barPercent, rateText, siteName, workModeName } from '../../lib/dashboard';
import { DashCard, DashSection, ShareBar, TD_CLASS, TH_CLASS } from './DashCard';

type Automation = DashboardResponse['automation'];

/** "42%" with a small bar, or "Too few to compare" under 5 applications. */
function RateCell({ count, of }: { count: number; of: number }) {
  const text = rateText({ count, of });
  if (!text) return <span className="text-text-tertiary">Too few</span>;
  return (
    <span className="inline-flex items-center justify-end gap-2.5">
      {text}
      <ShareBar
        percent={barPercent(count, of)}
        color="bg-chart-2"
        className="h-1.5 w-16 max-md:hidden"
      />
    </span>
  );
}

function SiteTable({ sites }: { sites: Automation['sites'] }) {
  return (
    <DashCard
      flush
      title="By site"
      note="Where your applications went, and which sites get answers."
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={TH_CLASS}>Site</th>
            <th className={`${TH_CLASS} text-right`}>Sent</th>
            <th className={`${TH_CLASS} text-right`}>Reply rate</th>
            <th className={`${TH_CLASS} text-right`}>Interviews</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site) => (
            <tr key={site.platform ?? 'none'} className="last:[&>td]:border-b-0">
              <td className={TD_CLASS}>{siteName(site.platform)}</td>
              <td className={`${TD_CLASS} text-right tabular-nums`}>{site.sent}</td>
              <td className={`${TD_CLASS} text-right tabular-nums`}>
                <RateCell count={site.answered} of={site.sent} />
              </td>
              <td className={`${TD_CLASS} text-right tabular-nums`}>
                {site.sent < RATE_BASE ? '' : rateText({ count: site.interviews, of: site.sent })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DashCard>
  );
}

function WorkModeTable({ modes }: { modes: Automation['workModes'] }) {
  return (
    <DashCard
      flush
      title="By work mode"
      note="Remote, hybrid or on-site, as your automation reported it."
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={TH_CLASS}>Work mode</th>
            <th className={`${TH_CLASS} text-right`}>Sent</th>
            <th className={`${TH_CLASS} text-right`}>Reply rate</th>
          </tr>
        </thead>
        <tbody>
          {modes.map((mode) => (
            <tr key={mode.workMode ?? 'none'} className="last:[&>td]:border-b-0">
              <td className={TD_CLASS}>{workModeName(mode.workMode)}</td>
              <td className={`${TD_CLASS} text-right tabular-nums`}>{mode.sent}</td>
              <td className={`${TD_CLASS} text-right tabular-nums`}>
                <RateCell count={mode.answered} of={mode.sent} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DashCard>
  );
}

function Coverage({ automation }: { automation: Automation }) {
  const parts = [
    { label: 'Sent', count: automation.sent, color: 'bg-chart-1' },
    { label: 'Skipped', count: automation.skipped, color: 'bg-chart-4' },
    { label: 'Needs you', count: automation.needsYou, color: 'bg-chart-3' },
  ];
  return (
    <DashCard
      title="What your automation did"
      aside={
        <Link to="/automation" className="text-link hover:underline">
          Open Automation
        </Link>
      }
    >
      <p className="mt-2 text-[28px] leading-9 font-light md:text-[32px] md:leading-10">
        {automation.lookedAt} jobs looked at
      </p>
      {automation.lookedAt > 0 && (
        <div className="mt-3 flex h-2 gap-0.5" aria-hidden>
          {parts
            .filter((part) => part.count > 0)
            .map((part) => (
              <div key={part.label} className={part.color} style={{ flexGrow: part.count }} />
            ))}
        </div>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-secondary">
        {parts.map((part) => (
          <li key={part.label} className="flex items-center gap-2">
            <span aria-hidden className={`size-2.5 ${part.color}`} />
            {part.label} {part.count}
          </li>
        ))}
      </ul>
      {automation.topSkipReasons.length > 0 && (
        <table className="-mx-4 mt-4 -mb-4 w-[calc(100%+2rem)] border-collapse text-sm md:-mx-6 md:-mb-6 md:w-[calc(100%+3rem)]">
          <thead>
            <tr>
              <th className={`${TH_CLASS} border-t border-t-border-subtle`}>
                Top reasons it skipped
              </th>
              <th className={`${TH_CLASS} border-t border-t-border-subtle text-right`}>Jobs</th>
            </tr>
          </thead>
          <tbody>
            {automation.topSkipReasons.map((reason) => (
              <tr key={reason.reason} className="last:[&>td]:border-b-0">
                <td className={TD_CLASS}>{reason.reason}</td>
                <td className={`${TD_CLASS} text-right tabular-nums`}>{reason.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashCard>
  );
}

/** What works best: only for users who sent applications through the automation (owner, 3 Nov 2026). */
export function WorksBest({ automation }: { automation: Automation }) {
  return (
    <DashSection title="What works best">
      <div className="grid gap-2 @min-[900px]:grid-cols-2">
        <SiteTable sites={automation.sites} />
        <WorkModeTable modes={automation.workModes} />
      </div>
      <Coverage automation={automation} />
    </DashSection>
  );
} 
