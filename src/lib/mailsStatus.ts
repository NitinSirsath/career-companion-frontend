import { format, isToday } from 'date-fns';
import { mailDate } from './mails';

/** When mail last came in, short: the time for today, else the day ("12:00 PM", "Nov 12"). */
export function shortSyncTime(iso: string): string {
  const date = new Date(iso);
  return isToday(date) ? format(date, 'h:mm a') : mailDate(iso);
}

interface GmailLine {
  connected: boolean;
  syncStatus?: string | null;
  lastSyncedAt?: unknown;
}

interface ReadingLine {
  words: { title: string; icon: string };
  status: { done: number; total: number };
}

/**
 * The words of the Mails page's status line on phones (owner, 13 Nov 2026): "Synced 12:00 PM",
 * then what the AI is doing ("3 new mails wait for AI"; while it reads, how far it is). `working`
 * while the AI reads: the words then shimmer.
 */
export function mailsStatusWords(gmail: GmailLine | undefined, view: ReadingLine | null) {
  let synced: string | null = null;
  if (gmail?.connected) {
    if (gmail.syncStatus === 'SYNCING') synced = 'Syncing…';
    else if (typeof gmail.lastSyncedAt === 'string')
      synced = `Synced ${shortSyncTime(gmail.lastSyncedAt)}`;
    else synced = 'Not synced yet';
  }
  if (!view) return { synced, ai: null, working: false };
  const working = view.words.icon === 'reading';
  const ai =
    working && view.status.total
      ? `${view.words.title} · ${view.status.done} of ${view.status.total}`
      : view.words.title;
  return { synced, ai, working };
}
