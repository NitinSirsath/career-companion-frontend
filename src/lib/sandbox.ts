import { z } from 'zod';
import { isApiError } from '../api/client';
import {
  SandboxFolderSchema,
  type SandboxMailResult,
  type SandboxMailState,
  type SandboxMessage,
  type SandboxThread,
} from '../contracts/sandbox';
import { mailAIInfo } from './mailAIStatus';
import { CATEGORY_LABEL, mailDateTime, parseSender, recipientNames } from './mails';

type BadgeVariant = 'success' | 'warning' | 'destructive' | 'info' | 'secondary';

/** What the app did with a sandbox mail, in the user's words. */
export const MAIL_STATE_LABEL: Record<SandboxMailState, string> = {
  NOT_SYNCED: 'Not synced yet',
  WAITING_FOR_AI: 'Waiting for AI',
  AI_KEY_MISSING: 'Not read: AI key is not set up',
  AI_FAILED: 'AI could not read it',
  NOT_JOB_MAIL: 'Not a job mail',
  JOB_MAIL: 'Job mail',
  REPLY_RECORDED: 'Recorded as your reply',
};

export const MAIL_STATE_VARIANT: Record<SandboxMailState, BadgeVariant> = {
  NOT_SYNCED: 'warning',
  WAITING_FOR_AI: 'info',
  AI_KEY_MISSING: 'destructive',
  AI_FAILED: 'destructive',
  NOT_JOB_MAIL: 'secondary',
  JOB_MAIL: 'success',
  REPLY_RECORDED: 'info',
};

const mails = (count: number) => `${count} mail${count === 1 ? '' : 's'}`;

/** The mark on a conversation row: unsynced mail first, else what the app did with the newest. */
export function threadMark(thread: Pick<SandboxThread, 'notSynced' | 'state'>): {
  label: string;
  variant: BadgeVariant;
} {
  if (thread.notSynced > 0 && thread.state !== 'NOT_SYNCED')
    return { label: `${thread.notSynced} not synced`, variant: 'warning' };
  return { label: MAIL_STATE_LABEL[thread.state], variant: MAIL_STATE_VARIANT[thread.state] };
}

/** "Last sync Today, 10:42 AM · 1 mail not synced". */
export function syncLine(lastSyncedAt: string | Date | null, notSynced: number): string {
  const at = lastSyncedAt instanceof Date ? lastSyncedAt.toISOString() : lastSyncedAt;
  const last = at ? `Last sync ${mailDateTime(at)}` : 'Never synced';
  return `${last} · ${notSynced > 0 ? `${mails(notSynced)} not synced` : 'all mails synced'}`;
}

/** One sentence on what the state means and what to do; null when the details say it all. */
export function mailStateDetail(
  result: Pick<SandboxMailResult, 'state' | 'aiStatus'>,
): string | null {
  switch (result.state) {
    case 'NOT_SYNCED':
      return 'The app has not seen this mail. Sync to bring it in.';
    case 'WAITING_FOR_AI':
      return 'Synced. The AI has not read it yet.';
    case 'AI_KEY_MISSING':
      return 'Synced, but not read. Add your AI key on the AI provider page.';
    case 'AI_FAILED': {
      // The same plain words as the (i) on the Gmail Sync row, never the stored category.
      const info = result.aiStatus && mailAIInfo(result.aiStatus, true);
      return `Synced, but the AI could not read it.${info ? ` ${info.title}. ${info.text}` : ''}`;
    }
    case 'NOT_JOB_MAIL':
      return 'The app read it and found it is not about a job.';
    case 'REPLY_RECORDED':
      return 'The app noted that you replied in this conversation.';
    case 'JOB_MAIL':
      return null;
  }
}

/** "Recruiter · Northwind Robotics · Senior Platform Engineer": what the AI read from a job mail. */
export function jobLine(job: NonNullable<SandboxMailResult['job']>): string {
  return [job.category ? CATEGORY_LABEL[job.category] : null, job.company, job.role]
    .filter(Boolean)
    .join(' · ');
}

/** A reply's own text and the earlier mail it quotes below, split at the "On … wrote:" line. */
export function splitQuote(text: string): { own: string; quoted: string | null } {
  const quote = /\n\nOn [^\n]+ wrote:\n>/.exec(text);
  if (!quote) return { own: text, quoted: null };
  return { own: text.slice(0, quote.index), quoted: text.slice(quote.index).trim() };
}

/** "to me · cc Daniel Okafor, Lena Fischer": who a sandbox mail went to. */
export function sandboxRecipients(
  message: Pick<SandboxMessage, 'sentByUser' | 'to' | 'cc'>,
): string {
  const to = message.sentByUser ? parseSender(message.to).name : 'me';
  const cc = recipientNames(message.cc);
  return `to ${to}${cc.length ? ` · cc ${cc.join(', ')}` : ''}`;
}

export const sandboxSearchSchema = z.object({ folder: SandboxFolderSchema.optional() });

export const FROM_PROBLEM = 'Enter a mail address, with or without a name.';
export const CC_PROBLEM = 'Enter mail addresses with commas between them, at most 10.';
export const BODY_PROBLEM = 'Write a message.';

/** What to tell the tester when a sandbox action did not work. */
export function sandboxProblem(error: unknown): string {
  if (isApiError(error) && error.code === 'GMAIL_NOT_CONNECTED')
    return 'The sandbox mailbox is not connected. Connect it on the Gmail Sync page first.';
  if (isApiError(error) && error.code === 'SYNC_IN_PROGRESS') return 'A sync is already running.';
  if (isApiError(error) && (error.kind === 'network' || error.kind === 'timeout'))
    return error.message;
  return 'That did not work. Try again.';
}
