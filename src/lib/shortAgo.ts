import { format, isThisYear } from 'date-fns';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * A phone list's date at the row's top right, as Linear iOS writes it (owner, 18 Nov 2026, mock
 * `PHONE-LINEAR-mock/`): "now", "12m", "2h", "5d", "3w", then the day.
 */
export function shortAgo(value: string | Date | null, now = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return '';
  const ago = Math.max(0, now.getTime() - time);
  if (ago < MINUTE) return 'now';
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)}m`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)}h`;
  if (ago < WEEK) return `${Math.floor(ago / DAY)}d`;
  if (ago < 5 * WEEK) return `${Math.floor(ago / WEEK)}w`;
  return format(date, isThisYear(date) ? 'MMM d' : 'MMM d, yyyy');
}
