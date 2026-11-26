import { format, isThisYear } from 'date-fns';
import type { Missed } from '../contracts/application';
import { deadlineLabel } from './deadline';

/**
 * The server's quiet limit, for the words only (owner, 26 Nov 2026: 7 days, not 14): how long
 * nothing may happen before a request is missed, how long "Still open" keeps it on the list, and
 * how old a job NorthList Apply left for the user may get.
 */
const QUIET_DAYS = 7;

/**
 * "Missed" (owner, 26 Nov 2026): an open request or step that nothing closed leaves Needs action
 * by itself, a day after its deadline or after a quiet week. It is dim, counted in no "needs you"
 * number, and has one action of its own, "Still open". The server decides what is missed; these
 * are the words for it.
 */
export const MISSED = {
  label: 'Missed',
  stillOpen: 'Still open',
  /** Under the Mails list while the Missed filter is on. */
  listNote: {
    phone: `These left Needs action by themselves: the deadline passed, or nothing happened for ${QUIET_DAYS} days. Swipe one to say it is still open.`,
    laptop: 'They left Needs action by themselves. "Still open" in the "…" menu puts one back.',
  },
  /** Under an application's steps on a phone, when one of them is missed. */
  stepsNote:
    'A missed step is not counted. Tap it to say it is still open. Steps from mails close by themselves when your reply or a newer mail settles them.',
  /** Under NorthList Apply's "Not submitted" list, when a job on the page is missed. */
  applyNote: `A job left for you is missed ${QUIET_DAYS} days after the run: the posting has moved on. It stays in this list, and is no longer counted as "Needs you".`,
} as const;

type MissedItem = {
  missed: Missed | null;
  deadline: string | Date | null;
  deadlinePrecision?: 'DATE' | 'DATETIME' | null;
};

/** "Nov 17", with the year when it is not this one. A date without a time is the same day everywhere. */
function shortDay(item: MissedItem): string {
  const date = new Date(item.deadline!);
  const day =
    item.deadlinePrecision === 'DATE'
      ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      : date;
  return format(day, isThisYear(day) ? 'MMM d' : 'MMM d, yyyy');
}

/**
 * Why it is missed, for after "Missed ·": "was due Nov 17" in a list row (`short`), with the year
 * and the time on its own page. Null when it is not missed.
 */
export function missedWhy(item: MissedItem, short = false): string | null {
  if (!item.missed) return null;
  if (item.missed.reason === 'NO_ANSWER') return 'no answer to your reply';
  if (item.missed.reason === 'QUIET' || !item.deadline) return `nothing new for ${QUIET_DAYS} days`;
  return `was due ${short ? shortDay(item) : deadlineLabel(item)}`;
}

/** "Missed · was due Nov 17, 2026 11:00 AM": where a missed step stands, in one grey line. */
export function missedLine(item: MissedItem, short = false): string {
  const why = missedWhy(item, short);
  return why ? `${MISSED.label} · ${why}` : MISSED.label;
}

const LEFT_BECAUSE: Record<Missed['reason'], string> = {
  DEADLINE_PASSED: 'Its deadline passed',
  QUIET: `Nothing happened here for ${QUIET_DAYS} days`,
  NO_ANSWER: 'They did not answer your reply for 7 days',
};

/**
 * Under a missed step: why it left the list, and what "Still open" does. `withDay` names the day
 * it left, where there is room for it.
 */
export function missedNote(missed: Missed, withDay = false): string {
  const day = withDay ? ` on ${format(new Date(missed.since), 'MMM d')}` : '';
  return `${LEFT_BECAUSE[missed.reason]}, so this left Needs action by itself${day}. ${MISSED.stillOpen} puts it back on your list for ${QUIET_DAYS} days.`;
}

/** "2 missed" */
export const missedCount = (count: number) => `${count} missed`;
