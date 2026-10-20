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
    ? 'Dev mode: the reply goes to the mail sandbox. No real mail is sent. Your earlier mails are added below your text, as in any mail app.'
    : 'Sent from your Gmail, in this conversation. Your earlier mails are added below your text, as in any mail app.';

/** "Priya Nair", "Priya Nair and Daniel Okafor", "Priya Nair, Daniel Okafor and Lena Fischer". */
const nameList = (names: string[]) =>
  names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

const namesOf = (people: string[]) => people.map((person) => parseSender(person).name);

/**
 * The wording of the reply box when other people are on the mail: what the reply does now, the
 * link to the other choice, and who is left out when the reply goes to the sender alone.
 */
export function replyChoice(
  replyTo: string,
  others: string[],
  toAll: boolean,
): { title: string; other: string; leftOut: string | null } {
  const sender = parseSender(replyTo).name;
  const people = others.length + 1;
  return toAll
    ? { title: `Reply to all · ${people} people`, other: `Reply only to ${sender}`, leftOut: null }
    : {
        title: `Reply only to ${sender}`,
        other: `Reply to all ${people} people`,
        leftOut: `${nameList(namesOf(others))} will not get this reply.`,
      };
}

/** "Reply sent to Priya Nair." `others` are the people in Cc of a reply to all. */
export const replySentNote = (replyTo: string, others: string[] = []) =>
  `Reply sent to ${nameList([parseSender(replyTo).name, ...namesOf(others)])}.`;
