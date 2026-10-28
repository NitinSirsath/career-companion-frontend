import type { DashboardTip } from '../contracts/dashboard';
import { hoursText, siteName } from './dashboard';

/**
 * The words of the Dashboard's rule tips (owner, 27 Oct 2026). The backend says which tips are
 * true and gives their facts; the words and their links have one home here.
 */
export interface TipWords {
  text: string;
  link: { label: string; to: 'GONE_QUIET' | 'MAILS_NEEDS_ACTION' } | null;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function tipWords(tip: DashboardTip): TipWords {
  switch (tip.kind) {
    case 'GONE_QUIET':
      return {
        text: `${plural(tip.count, 'job has', 'jobs have')} gone quiet. Follow up, or close the ones you have given up on.`,
        link: { label: tip.count === 1 ? 'See it' : 'See them', to: 'GONE_QUIET' },
      };
    case 'REPLY_TIME': {
      const speed = hoursText(tip.medianReplyHours);
      const pace = speed ? `You answer recruiters in ${speed.toLowerCase()}.` : '';
      const waiting = tip.waitingOverADay
        ? `${plural(tip.waitingOverADay, 'mail has', 'mails have')} waited more than a day.`
        : '';
      return {
        text: [pace, waiting].filter(Boolean).join(' '),
        link: tip.waitingOverADay
          ? { label: tip.waitingOverADay === 1 ? 'Open it' : 'Open them', to: 'MAILS_NEEDS_ACTION' }
          : null,
      };
    }
    case 'SITE_ANSWERS_MORE':
      return {
        text: `${siteName(tip.site)} gets you replies more often than ${siteName(tip.otherSite)}: ${tip.percent}% against ${tip.otherPercent}%.`,
        link: null,
      };
    case 'EARLY_DAYS':
      return {
        text:
          tip.medianDays === null
            ? 'Replies usually come 1 to 2 weeks after you apply. Your first jobs are newer than that, so it is early.'
            : `Companies have answered in about ${Math.round(tip.medianDays)} days so far. Your first jobs are new, so more answers may still come.`,
        link: null,
      };
  }
}
