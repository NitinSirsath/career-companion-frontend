import { z } from 'zod';
import type { ApplicationStatus } from '../contracts/application';
import { DashboardPeriodSchema, type DashboardPeriod } from '../contracts/dashboard';
import type { StatusTab } from './applicationsView';
import { platformLabel } from './eventLabels';

/**
 * The Dashboard's words and choices (owner, 27 Oct 2026). The numbers come from the backend;
 * these say them in plain words.
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

/** The steps of an active job, in job-search order. */
export const ACTIVE_STEPS = [
  'APPLIED',
  'RECRUITER_CONTACT',
  'ASSESSMENT',
  'INTERVIEW',
  'OFFER',
] as const satisfies readonly ApplicationStatus[];

/** The Applications tab that lists a step. Applied is the "Applied" tab, called RECEIVED there. */
export const stepTab = (status: (typeof ACTIVE_STEPS)[number]): StatusTab =>
  status === 'APPLIED' ? 'RECEIVED' : status;

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

/** "About 6 days", "About 1 day", "Same day". */
export function daysText(days: number | null): string | null {
  if (days === null) return null;
  if (days < 1) return 'Same day';
  return `About ${plural(Math.round(days), 'day', 'days')}`;
}

/** "About 9 hours", "Under an hour", "About 2 days". */
export function hoursText(hours: number | null): string | null {
  if (hours === null) return null;
  if (hours < 1) return 'Under an hour';
  if (hours < 48) return `About ${plural(Math.round(hours), 'hour', 'hours')}`;
  return `About ${plural(Math.round(hours / 24), 'day', 'days')}`;
}

/** The answer-speed note under the median. */
export function answerSpeedNote(answered: number, median: number | null, p80: number | null) {
  if (!answered || median === null) return 'No company has answered in this period yet.';
  if (answered < RATE_BASE)
    return `${plural(answered, 'company has', 'companies have')} answered so far.`;
  return `Half of the companies that answered did so within ${plural(Math.round(median), 'day', 'days')}; 8 in 10 within ${plural(p80 ?? 0, 'day', 'days')}.`;
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

/** "Week of Oct 26" for a YYYY-MM-DD Monday. */
export const weekLabel = (weekStart: string) =>
  new Date(`${weekStart}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export const quietText = (days: number) => plural(days, 'day', 'days');
