import type { DashboardResponse } from '../../contracts/dashboard';
import { interviewWhen } from '../../lib/dashboard';
import { missedCount } from '../../lib/missed';

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

/**
 * Under "Needs action". The requests that left it by themselves are named at the end, "· 2 missed"
 * (owner, 26 Nov 2026): they are not in the number above.
 */
export function needsActionLine({ count, waitingOverADay, missed }: Now['needsAction']) {
  const tail = missed > 0 ? ` · ${missedCount(missed)}` : '';
  if (!count) return `Nothing is waiting on you${tail}`;
  if (!waitingOverADay) return `Answer them, or mark them done${tail}`;
  return (
    <>
      <strong className={STRONG}>{waitingOverADay}</strong> waiting over a day{tail}
    </>
  );
}

/** The next interview; phones leave out the company, the tile has no room for it. */
export function interviewLine({ next }: Now['interviews'], withCompany = true) {
  if (!next) return 'No interviews booked yet';
  return (
    <>
      Next: <strong className={STRONG}>{interviewWhen(next)}</strong>
      {withCompany && next.companyName && ` · ${next.companyName}`}
    </>
  );
}
