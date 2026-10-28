import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { DashboardResponse } from '../../contracts/dashboard';
import { answerSpeedNote, daysText, hoursText, quietText } from '../../lib/dashboard';
import { STATUS_LABEL } from '../../lib/statusLabels';
import { statusTag } from '../../lib/statusTags';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';
import { Tag } from '../ui/tag';
import { BigNumber, DashCard, TD_CLASS, TH_CLASS } from './DashCard';

/** Show this many quiet jobs; the rest open in place. */
const QUIET_SHOWN = 5;

type QuietJob = DashboardResponse['goneQuiet']['jobs'][number];

function QuietRows({ jobs }: { jobs: QuietJob[] }) {
  return jobs.map((job) => (
    <tr key={job.applicationId}>
      <td className={TD_CLASS}>
        <Link
          to="/applications/$id"
          params={{ id: job.applicationId }}
          className="underline decoration-border-default underline-offset-3 hover:decoration-current"
        >
          {job.companyName}
        </Link>
        {job.jobTitle && <div className="text-xs text-text-secondary">{job.jobTitle}</div>}
      </td>
      <td className={`${TD_CLASS} max-md:hidden`}>
        {/* A job with no status yet counts as applied, as everywhere on the Dashboard. */}
        <Tag color={statusTag(job.status ?? 'APPLIED').color}>
          {STATUS_LABEL[job.status ?? 'APPLIED']}
        </Tag>
      </td>
      <td className={`${TD_CLASS} text-right whitespace-nowrap tabular-nums`}>
        {quietText(job.daysQuiet)}
      </td>
    </tr>
  ));
}

/** Jobs gone quiet (owner, 27 Oct 2026): follow up, or close them to clean the list. */
export function GoneQuiet({ quiet }: { quiet: DashboardResponse['goneQuiet'] }) {
  const [all, setAll] = useState(false);
  const rule = 'No reply for 21 days at Applied, or no new mail for 14 days in a later step.';
  if (!quiet.count)
    return (
      <DashCard title="Gone quiet">
        <p className="mt-3 text-xs text-text-secondary">
          No job has gone quiet. A job shows here after 21 days at Applied with no reply, or 14 days
          in a later step with no new mail.
        </p>
      </DashCard>
    );
  const more = quiet.jobs.length - QUIET_SHOWN;
  return (
    <DashCard
      flush
      title="Gone quiet"
      aside={`${quiet.count} ${quiet.count === 1 ? 'job' : 'jobs'}`}
      note={`${rule} Follow up, or close them.`}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={TH_CLASS}>Job</th>
            <th className={`${TH_CLASS} max-md:hidden`}>Step</th>
            <th className={`${TH_CLASS} text-right`}>Quiet for</th>
          </tr>
        </thead>
        <tbody>
          <QuietRows jobs={quiet.jobs.slice(0, QUIET_SHOWN)} />
        </tbody>
      </table>
      {more > 0 && (
        <>
          <Collapse open={all}>
            <table className="w-full border-collapse text-sm">
              <tbody>
                <QuietRows jobs={quiet.jobs.slice(QUIET_SHOWN)} />
              </tbody>
            </table>
          </Collapse>
          <div className="px-2 py-2 md:px-4">
            <Button variant="ghost" size="sm" aria-expanded={all} onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show all ${quiet.jobs.length}`}
            </Button>
          </div>
        </>
      )}
    </DashCard>
  );
}

/** How fast companies answer: it sets the user's expectations. */
export function AnswerSpeed({ speed }: { speed: DashboardResponse['answerSpeed'] }) {
  return (
    <DashCard title="How fast companies answer">
      <BigNumber className="mt-2">{daysText(speed.medianDays) ?? 'Not yet'}</BigNumber>
      <p className="text-xs text-text-secondary">
        {answerSpeedNote(speed.answered, speed.medianDays, speed.p80Days)}
      </p>
      {speed.slowest.length > 0 && (
        <table className="-mx-4 mt-4 -mb-4 w-[calc(100%+2rem)] border-collapse text-sm md:-mx-6 md:-mb-6 md:w-[calc(100%+3rem)]">
          <thead>
            <tr>
              <th className={`${TH_CLASS} border-t border-t-border-subtle`}>Slowest to answer</th>
              <th className={`${TH_CLASS} border-t border-t-border-subtle text-right`}>Days</th>
            </tr>
          </thead>
          <tbody>
            {speed.slowest.map((company) => (
              <tr key={company.companyName} className="last:[&>td]:border-b-0">
                <td className={TD_CLASS}>{company.companyName}</td>
                <td className={`${TD_CLASS} text-right tabular-nums`}>{company.days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DashCard>
  );
}

/** Whether the user answers recruiters fast and finishes what mails ask for. */
export function KeepingUp({ keeping }: { keeping: DashboardResponse['keepingUp'] }) {
  const { closed } = keeping;
  const parts = [
    { label: 'Your reply', count: closed.yourReply, color: 'bg-chart-1' },
    { label: 'You said done', count: closed.youSaidDone, color: 'bg-chart-2' },
    { label: 'A newer mail', count: closed.newerMail, color: 'bg-chart-3' },
    { label: 'Job closed', count: closed.applicationClosed, color: 'bg-chart-4' },
  ].filter((part) => part.count > 0);
  const done = parts.reduce((sum, part) => sum + part.count, 0);
  return (
    <DashCard title="How you keep up">
      <p className="mt-3 text-xs text-text-secondary">Your reply time to recruiters</p>
      <BigNumber>{hoursText(keeping.medianReplyHours) ?? 'Not yet'}</BigNumber>
      <p className="text-xs text-text-secondary">
        {keeping.replied
          ? `Median over ${keeping.replied} recruiter ${keeping.replied === 1 ? 'mail' : 'mails'} that asked for an answer.`
          : 'No recruiter mail asked you for an answer in this period.'}
      </p>
      <p className="mt-5 text-xs text-text-secondary">Things mails asked for, done this period</p>
      <BigNumber>{done}</BigNumber>
      {done > 0 && (
        <>
          <div className="mt-3 flex h-2 gap-0.5" aria-hidden>
            {parts.map((part) => (
              <div key={part.label} className={part.color} style={{ flexGrow: part.count }} />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-secondary">
            {parts.map((part) => (
              <li key={part.label} className="flex items-center gap-2">
                <span aria-hidden className={`size-2.5 ${part.color}`} />
                {part.label} {part.count}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-4 text-xs">
        {keeping.openNow ? (
          <Link to="/mails" search={{ request: 'open' }} className="text-link hover:underline">
            {keeping.openNow} still {keeping.openNow === 1 ? 'needs' : 'need'} you in Mails
          </Link>
        ) : (
          <span className="text-text-secondary">Nothing waits for you.</span>
        )}
      </p>
    </DashCard>
  );
}

/** The fake offers the app caught: it shows the AI protects the user. */
export function KeptSafe({ fakeOffers }: { fakeOffers: number }) {
  return (
    <DashCard title="Kept safe">
      <BigNumber className="mt-2">
        {fakeOffers} fake {fakeOffers === 1 ? 'offer' : 'offers'} caught
      </BigNumber>
      <p className="text-xs text-text-secondary">
        Mails that asked for money or bank details to get a job. NorthList warned you and made no
        to-do from them.
      </p>
    </DashCard>
  );
}
