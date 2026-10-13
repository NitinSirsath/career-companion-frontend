import { isApiError } from '../api/client';
import { SendMailReplyRequestSchema } from '../contracts/mailbox';
import { parseSender } from './mails';

/** The reply box asks for the text only; the reply's own ID is made by the page. */
export const ReplyTextSchema = SendMailReplyRequestSchema.pick({ text: true });

export const REPLY_TEXT_PROBLEM = 'Write your reply.';
export const REPLY_TOO_LONG = 'This reply is too long to send from here.';

/** Why a reply did not go out as asked, and what the user can do about it. */
export type ReplyProblem =
  /** The mail may have gone out. Nothing is sent again unless the user says so. */
  | { kind: 'unconfirmed' }
  /** Gmail is connected for reading only. */
  | { kind: 'allow-sending' }
  /** Nothing was sent; the server said why. */
  | { kind: 'not-sent'; message: string };

/**
 * A reply that got no clear answer may have been sent: a timeout, a lost connection, or a server
 * error. Only "Gmail is busy" is a server answer that says nothing was sent.
 */
export function replyProblem(error: unknown): ReplyProblem {
  if (!isApiError(error)) return { kind: 'unconfirmed' };
  if (error.code === 'GMAIL_SEND_NOT_ALLOWED') return { kind: 'allow-sending' };
  if (error.code === 'MAIL_REPLY_UNCONFIRMED') return { kind: 'unconfirmed' };
  if (error.outcomeUncertain && error.code !== 'GMAIL_UNAVAILABLE') return { kind: 'unconfirmed' };
  return { kind: 'not-sent', message: error.message };
}

/** Connects Gmail again, asking for sending too, and comes back to this mail. */
export const allowSendingUrl = (mailPath: string) =>
  `/api/gmail/connect?returnTo=${encodeURIComponent(mailPath)}`;

export const replyHint = (devMode: boolean) =>
  devMode
    ? 'Dev mode: the reply goes to the mail sandbox. No real mail is sent. The earlier mail is quoted below your text.'
    : 'Sent from your Gmail, in this conversation. The earlier mail is quoted below your text.';

/** "Reply sent to Priya Nair." */
export const replySentNote = (replyTo: string) => `Reply sent to ${parseSender(replyTo).name}.`;
