import { differenceInCalendarDays, format } from 'date-fns';

type Deadline = { deadline: string | Date | null; deadlinePrecision?: 'DATE' | 'DATETIME' | null };
export function deadlineLabel(action: Deadline, detail = false, timeZone?: string): string {
  if (!action.deadline) return '';
  const date = new Date(action.deadline);
  if (action.deadlinePrecision === 'DATE')
    return date.toLocaleDateString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  if (timeZone)
    return date.toLocaleString('en-US', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(detail ? {} : { hour: 'numeric', minute: '2-digit' }),
    });
  return format(date, detail ? 'MMM d, yyyy' : 'MMM d, yyyy h:mm a');
}
export function deadlineOverdue(action: Deadline, now: Date): boolean {
  if (!action.deadline) return false;
  const date = new Date(action.deadline);
  if (action.deadlinePrecision !== 'DATE') return date.getTime() < now.getTime();
  const dateKey =
    date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const todayKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return dateKey < todayKey;
}

/**
 * A to-do's due date in a phone row (mock `PHONE-LINEAR-mock/` screen 6, 18 Nov 2026): "Past due",
 * "Due today", "Due tomorrow", "Due Mon" within a week, else "Due Nov 24".
 */
export function shortDue(action: Deadline, now: Date): string {
  if (!action.deadline) return '';
  if (deadlineOverdue(action, now)) return 'Past due';
  const date = new Date(action.deadline);
  // A DATE deadline is a calendar day, kept at midnight UTC.
  const local =
    action.deadlinePrecision === 'DATE'
      ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
      : date;
  const days = differenceInCalendarDays(local, now);
  if (days <= 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due ${format(local, 'EEE')}`;
  return `Due ${format(local, 'MMM d')}`;
}
