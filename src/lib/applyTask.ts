/**
 * Names and times of NorthList Apply runs (owner, 25 Nov 2026). A run is named by when it started,
 * in the user's own time as Apply wrote it: "Today 9:02 pm", "Yesterday 9:02 pm", "Tuesday
 * 9:02 pm", and older ones "Mon 16 Nov, 9:02 pm".
 */
import type { ApplyTask, ApplyTaskPlanItem } from '../contracts/submission';
import { platformLabel } from './eventLabels';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

/** The wall clock at `iso` in a fixed UTC offset, read with the getUTC* methods. */
const wallClock = (iso: string | Date, offsetMinutes: number) =>
  new Date(new Date(iso).getTime() + offsetMinutes * 60_000);

const dayNumber = (wall: Date) =>
  Math.floor(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()) / DAY_MS);

function clock(wall: Date) {
  const h = wall.getUTCHours();
  const m = String(wall.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** The run's name: its start day and time in the user's time then. */
export function taskName(
  task: Pick<ApplyTask, 'startedAt' | 'utcOffsetMinutes'>,
  now = new Date(),
) {
  const start = wallClock(task.startedAt, task.utcOffsetMinutes);
  const today = wallClock(now, task.utcOffsetMinutes);
  const days = dayNumber(today) - dayNumber(start);
  const time = clock(start);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) return `${WEEKDAYS[start.getUTCDay()]} ${time}`;
  const year =
    start.getUTCFullYear() === today.getUTCFullYear() ? '' : ` ${start.getUTCFullYear()}`;
  return `${WEEKDAYS[start.getUTCDay()].slice(0, 3)} ${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}${year}, ${time}`;
}

/** "47 min", "1 h 4 min", "2 h". Never below a minute. */
export function duration(minutes: number) {
  const total = Math.max(1, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Minutes from the start to the newest entry; null while the run has none. */
export function taskMinutes(task: Pick<ApplyTask, 'startedAt' | 'lastAt'>) {
  if (!task.lastAt) return null;
  return Math.max(0, (Date.parse(task.lastAt) - Date.parse(task.startedAt)) / 60_000);
}

/** The jobs the run asked for, over the plan items that have a number. */
export const plannedTotal = (plan: ApplyTaskPlanItem[]) =>
  plan.reduce((n, item) => n + (item.planned ?? 0), 0);

const SOURCE_LABEL: Record<string, string> = {
  the_reliable_jobs: 'The Reliable Jobs',
  teksystems: 'TEKsystems',
  teksands: 'Teksands',
  d4hire: 'D4Hire',
  supersourcing: 'Supersourcing',
};

/** A plan item's name: a site, or a job source. */
export const siteName = (site: string) => SOURCE_LABEL[site] ?? platformLabel(site);

/** "8 of 10", or "2" for a site outside the plan. */
export const planItemCount = (item: ApplyTaskPlanItem) =>
  item.planned === null ? String(item.sent) : `${item.sent} of ${item.planned}`;
