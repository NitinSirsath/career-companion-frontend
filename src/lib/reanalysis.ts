import type {
  ReanalysisBlock,
  ReanalysisPreview,
  ReanalysisRun,
  ReanalysisStopReason,
} from '../contracts/reanalysis';

/** Why a run stopped, as the grey line under the step says it (owner, 19 Nov 2026, mock L5). */
const STOPPED: Record<ReanalysisStopReason, string> = {
  NEW_ACTIVITY: 'a new mail came in or something changed while reading. Try again.',
  GMAIL_DISCONNECTED: 'connect Gmail again.',
  GMAIL_FAILED: 'Gmail did not answer. Try again.',
  AI_BUSY: 'your AI is busy. Try again in a few minutes.',
  AI_LIMIT: 'your AI reached its limit for today.',
  AI_UNAVAILABLE: 'your AI is not ready. Check it in Settings.',
  TOO_SLOW: 'it took too long. Try again.',
  INTERRUPTED: 'the app restarted while reading. Try again.',
  SUSPENDED: 'your account is suspended.',
  FAILED: 'something went wrong. Try again.',
};

/** Why it cannot start now, as the confirm says it. */
const BLOCKED: Record<ReanalysisBlock, string> = {
  NOTHING_TO_READ: 'There is no job mail here the AI finished reading.',
  STILL_READING: 'A mail or reply here is still being read. Try again in a minute.',
  RUN_OPEN: 'A Reanalyze is already running. Try again when it is done.',
  REANALYZED_RECENTLY: 'This was reanalyzed a few minutes ago. Try again after 10 minutes.',
  APPLICATION_ARCHIVED: 'This application is archived.',
  TOO_LONG: 'This conversation is too long to reanalyze (over 20 mails and replies).',
  AI_UNAVAILABLE: 'Your AI is not ready. Check it in Settings.',
  AI_RESERVE: 'Not enough AI reads left today: some are always kept for your new mail.',
  GMAIL_DISCONNECTED: 'Connect Gmail again to reanalyze.',
};

export const blockedText = (block: ReanalysisBlock) => BLOCKED[block];

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Not reanalyzed: Gmail did not answer. Try again. Nothing changed." */
export function stoppedText(run: ReanalysisRun) {
  const why = STOPPED[run.stopReason ?? 'FAILED'];
  if (run.saved > 0)
    return `Reanalyzed ${run.saved} of ${count(run.conversations, 'conversation')}, then stopped: ${why}`;
  return `Not reanalyzed: ${why} Nothing changed.`;
}

/** "Reanalyzed. 2 things changed" (the toast when a run saved). */
export function savedText(run: ReanalysisRun) {
  const changed = run.changed ? `${count(run.changed, 'thing')} changed` : 'Nothing changed';
  const gone = run.gone ? ` ${count(run.gone, 'mail')} no longer in Gmail kept the old read.` : '';
  return `Reanalyzed. ${changed}.${gone}`;
}

/** A run that stopped in the last 10 minutes still shows its line. */
export const recentlyStopped = (run: ReanalysisRun | null | undefined) =>
  run?.state === 'STOPPED' &&
  !!run.finishedAt &&
  Date.now() - Date.parse(run.finishedAt) < 10 * 60_000;

/** "Reanalyzing", or on the application page "Reanalyzing 2 conversations". */
export function readingText(
  target: { kind: 'conversation' | 'application' },
  run: ReanalysisRun | null | undefined,
) {
  if (target.kind === 'conversation' || !run) return 'Reanalyzing';
  return `Reanalyzing ${count(run.conversations, 'conversation')}`;
}

/** "1 mail and your 1 reply" for the confirm. */
export function whatIsRead(preview: ReanalysisPreview) {
  const mails = count(preview.mails, 'mail');
  if (!preview.replies) return mails;
  return `${mails} and your ${count(preview.replies, 'reply', 'replies')}`;
}

/** Why an agenda date no longer counts: its mail moved, was unlinked, or was reanalyzed. */
export function agendaRetiredText(reason: 'EMAIL_MOVED' | 'EMAIL_UNLINKED' | 'REANALYZED' | null) {
  if (reason === 'REANALYZED') return 'Retired: Reanalyze no longer found this date in the mail.';
  return `Retired after the email link was ${reason === 'EMAIL_MOVED' ? 'moved' : 'removed'}.`;
}
