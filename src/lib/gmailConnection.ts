import type { GmailStatusResponse } from '../contracts/gmail';
import { mailDateTime } from './mails';

/**
 * Words for the Gmail connection card. `sandbox`: the mail sandbox stands in for Gmail (dev mode,
 * or a test account).
 */
export function gmailConnectionCopy(sandbox: boolean, status: string | null | undefined) {
  if (sandbox)
    return {
      connect: 'Connect sandbox mailbox',
      notConnected:
        'Not connected. Here your Gmail account is the mail sandbox: no Google account is used.',
      connectedNote: 'Sandbox mailbox.',
    };
  const revoked = status === 'REVOKED';
  return {
    connect: revoked ? 'Reconnect Gmail' : 'Connect Gmail',
    notConnected: revoked
      ? 'Gmail access was revoked. Please reconnect.'
      : 'Gmail is not connected. Connect it so the app can read your job mails.',
    connectedNote: null,
  };
}

/**
 * The Gmail sync page's header line: when mail last came in and when it comes next, for example
 * "Synced Today, 4:34 PM · next sync Today, 6:00 PM".
 */
export function gmailSyncLine(
  status: Pick<GmailStatusResponse, 'syncStatus' | 'lastSyncedAt' | 'nextScheduledSyncAt'>,
): string {
  let done = status.lastSyncedAt
    ? `Synced ${mailDateTime(String(status.lastSyncedAt))}`
    : 'Not synced yet';
  if (status.syncStatus === 'FAILED') done = 'Last sync failed';
  const next = status.nextScheduledSyncAt
    ? `next sync ${mailDateTime(status.nextScheduledSyncAt)}`
    : 'automatic sync is off';
  return `${done} · ${next}`;
}
