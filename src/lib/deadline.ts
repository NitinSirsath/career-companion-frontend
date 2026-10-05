import { format } from 'date-fns';

type Deadline = { deadline: string | Date | null; deadlinePrecision?: 'DATE' | 'DATETIME' | null };
export function deadlineLabel(action: Deadline, detail = false, timeZone?: string): string {
  if (!action.deadline) return '';
  const date = new Date(action.deadline);
  if (action.deadlinePrecision === 'DATE') return date.toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' });
  if (timeZone) return date.toLocaleString('en-US', { timeZone, year: 'numeric', month: 'short', day: 'numeric', ...(detail ? {} : { hour: 'numeric', minute: '2-digit' }) });
  return format(date, detail ? 'MMM d, yyyy' : 'MMM d, yyyy h:mm a');
}
export function deadlineOverdue(action: Deadline, now: Date): boolean {
  if (!action.deadline) return false;
  const date = new Date(action.deadline);
  if (action.deadlinePrecision !== 'DATE') return date.getTime() < now.getTime();
  const dateKey = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const todayKey = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return dateKey < todayKey;
}
