import type { DashboardResponse } from '../../contracts/dashboard';
import { interviewWhen } from '../../lib/dashboard';

type Now = DashboardResponse['now'];

/** The one line under each "Needs you" item, on laptops and phones. */
const STRONG = 'font-medium text-text-primary';

export function newMailsLine({ count, today }: Now['newJobMails']) {
  if (!count) return 'You have opened every job mail';
  if (!today) return 'Not opened yet';
  return (
    <>
      <strong className={STRONG}>{today} today</strong> · not opened yet
    </>
  );
}

export function needsActionLine({ count, waitingOverADay }: Now['needsAction']) {
  if (!count) return 'Nothing is waiting on you';
  if (!waitingOverADay) return 'Answer them, or mark them done';
  return (
    <>
      <strong className={STRONG}>{waitingOverADay}</strong> waiting over a day
    </>
  );
}

/** The next interview; phones leave out the company, the tile has no room for it. */
export function interviewLine({ next }: Now['interviews'], withCompany = true) {
  if (!next) return 'No interviews booked yet';
  return (
    <>
      Next: <strong className={STRONG}>{interviewWhen(next)}</strong>
      {withCompany && next.companyName && \` · ${next.companyName}\`}
    </>
  );
}
