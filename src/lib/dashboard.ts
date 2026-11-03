import { z } from 'zod';
import {
  DashboardPeriodSchema,
  type DashboardPeriod,
  type DashboardResponse,
} from '../contracts/dashboard';
import { platformLabel } from './eventLabels';

/**
 * The Dashboard's words and choices (owner, 27 Oct 2026; reworked 3 Nov 2026). The numbers come
 * from the backend; these say them in plain words.
 */

export const PERIOD_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'Since you connected Gmail' },
] as const satisfies readonly { value: DashboardPeriod; label: string }[];

/** The period is in the address, so a reload or Back keeps it. */
export const dashboardSearchSchema = z.object({
  period: DashboardPeriodSchema.optional().catch(undefined),
});

export const DEFAULT_PERIOD: DashboardPeriod = '30d';

/** A share means something from this many applications (owner, 27 Oct 2026). */
export const RATE_BASE = 5;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "↑ 8 vs the 30 days before", "Same as the 30 days before", or "Since Oct 22" for "all". */
export function changeText(
  current: number,
  previous: number | null,
  period: DashboardPeriod,
  since: string | null,
): string {
  if (previous === null) return since ? `Since ${shortDate(since)}` : '';
  const span = PERIOD_SPAN[period as Exclude<DashboardPeriod, 'all'>];
  const diff = current - previous;
  if (diff === 0) return `Same as the ${span} before`;
  return `${diff > 0 ? '↑' : '↓'} ${Math.abs(diff)} vs the ${span} before`;
}

const PERIOD_SPAN: Record<Exclude<DashboardPeriod, 'all'>, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** "35%", or null when it rests on fewer than 5 applications: then the page shows "1 of 3". */
export function rateText({ count, of }: { count: number; of: number }): string | null {
  if (of < RATE_BASE) return null;
  return `${Math.round((count / of) * 100)}%`;
}

export const countOf = (count: number, of: number) => `${count} of ${of}`;

/** The share as a bar width, 0 to 100. */
export const barPercent = (count: number, of: number) => (of ? (count / of) * 100 : 0);

/** The usual wait for a reply: "6 days", "1 day", "Same day". */
export function replyDaysText(days: number): string {
  if (days < 1) return 'Same day';
  return plural(Math.round(days), 'day', 'days');
}

export const siteName = (platform: string | null) =>
  platform === null ? 'Not from automation' : platformLabel(platform);

const WORK_MODE_LABEL: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  'on-site': 'On-site',
};

export const workModeName = (mode: string | null) =>
  mode === null ? 'Not given' : (WORK_MODE_LABEL[mode] ?? mode);

export const quietText = (days: number) => plural(days, 'day', 'days');

/** "Good morning, Nitin": by the hour of the browser's clock, with the first name when known. */
export function greeting(name: string | null | undefined, now = new Date()): string {
  const hour = now.getHours();
  let words = 'Good evening';
  if (hour < 12) words = 'Good morning';
  else if (hour < 18) words = 'Good afternoon';
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${words}, ${first}` : words;
}

/** "Tuesday, November 3 · your job search, from your mails since Oct 4". */
export function todayLine(dataStartsAt: string | null, now = new Date()): string {
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return dataStartsAt
    ? `${today} · your job search, from your mails since ${shortDate(dataStartsAt)}`
    : today;
}

/** A YYYY-MM-DD day, read as a calendar day wherever the browser is. */
const calendarDay = (day: string, options: Intl.DateTimeFormatOptions) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });

/** "2:30 PM" for "14:30". */
export function clockText(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

type NextInterview = NonNullable<DashboardResponse['now']['interviews']['next']>;

/** "Thu, Nov 5 · 10:00 AM", or the day alone when the mail gave no clear time. */
export function interviewWhen(next: Pick<NextInterview, 'date' | 'time'>): string {
  const day = calendarDay(next.date, { weekday: 'short', month: 'short', day: 'numeric' });
  return next.time ? `${day} · ${clockText(next.time)}` : day;
}

/** "214 in the last 30 days", or "since you connected Gmail" for the whole time. */
export function inPeriodText(count: number, period: DashboardPeriod): string {
  if (period === 'all') return `${count} since you connected Gmail`;
  return `${count} in the last ${PERIOD_SPAN[period]}`;
}

type Point = DashboardResponse['series']['points'][number];

/** The x-axis name of a point: "Oct 5"; the tooltip names the day or the week in full. */
export function pointLabel(start: string): string {
  return calendarDay(start, { month: 'short', day: 'numeric' });
}

export function pointTitle(start: string, bucket: DashboardResponse['series']['bucket']): string {
  if (bucket === 'week') return `Week of ${pointLabel(start)}`;
  return calendarDay(start, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** The dates under a chart: one a week from the first day (one in four weeks for a long period). */
export function axisTicks(
  points: Point[],
  bucket: DashboardResponse['series']['bucket'],
): string[] {
  const every = bucket === 'week' ? 4 : 7;
  return points.filter((_, i) => i % every === 0).map((point) => pointLabel(point.start));
}

/** "Oct 5 to Nov 3": the span the charts cover. */
export function seriesSpan(points: Point[]): string {
  const first = points[0];
  const last = points[points.length - 1];
  return first && last ? `${pointLabel(first.start)} to ${pointLabel(last.start)}` : '';
}

/** The running total of applications, replies and interviews at each point of the period. */
export function runningTotals(points: Point[]) {
  let sent = 0;
  let replies = 0;
  let interviews = 0;
  return points.map((point) => {
    sent += point.applicationsSent;
    replies += point.replies;
    interviews += point.interviews;
    return { start: point.start, applicationsSent: sent, replies, interviews };
  });
}

/** How many of the 12 weekly points of a trend line fall in the period: they are drawn in blue. */
export function periodWeeks(period: DashboardPeriod): number {
  if (period === '7d') return 2;
  if (period === '30d') return 5;
  return 12;
}
