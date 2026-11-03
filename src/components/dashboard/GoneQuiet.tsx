import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { DashboardResponse } from '../../contracts/dashboard';
import { quietText } from '../../lib/dashboard';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';
import { DashCard } from './DashCard';

/** Show this many quiet jobs; the rest open in place. */
const QUIET_SHOWN = 3;

type QuietJob = DashboardResponse['goneQuiet']['jobs'][number];

function QuietRows({ jobs }: { jobs: QuietJob[] }) {
  return (
    <ul>
      {jobs.map((job) => (
        <li key={job.applicationId} className="border-t-2 border-background">
          <Link
            to="/applications/$id"
            params={{ id: job.applicationId }}
            className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-3"
          >
            <span className="truncate font-medium group-hover:underline">{job.companyName}</span>
            <span className="row-span-2 self-center text-xs text-text-secondary tabular-nums">
              {quietText(job.daysQuiet)}
            </span>
            {job.jobTitle && (
              <span className="truncate text-xs text-text-secondary">{job.jobTitle}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Jobs gone quiet (owner, 27 Oct 2026): no reply for 21 days at Applied, or no new mail for 14
 * days in a later step. Follow up, or close them.
 */
export function GoneQuiet({ quiet }: { quiet: DashboardResponse['goneQuiet'] }) {
  const [all, setAll] = useState(false);
  if (!quiet.count)
    return (
      <DashCard title="Gone quiet">
        <p className="mt-3 text-xs text-text-secondary">
          No job has gone quiet. A job shows here after 3 weeks at Applied with no reply, or 2 weeks
          in a later step with no new mail.
        </p>
      </DashCard>
    );
  const more = quiet.jobs.length - QUIET_SHOWN;
  return (
    <DashCard title="Gone quiet" aside="No news in 2 to 3 weeks">
      <div className="mt-3">
        <QuietRows jobs={quiet.jobs.slice(0, QUIET_SHOWN)} />
        {more > 0 && (
          <>
            <Collapse open={all}>
              <QuietRows jobs={quiet.jobs.slice(QUIET_SHOWN)} />
            </Collapse>
            <div className="-mx-3 border-t-2 border-background pt-2">
              <Button variant="ghost" size="sm" aria-expanded={all} onClick={() => setAll(!all)}>
                {all ? 'Show fewer' : `Show all ${quiet.jobs.length}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashCard>
  );
}
