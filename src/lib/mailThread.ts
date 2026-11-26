import { differenceInCalendarDays, format, isThisYear, isToday, isYesterday } from 'date-fns';
import type {
  ConversationDetail,
  ConversationMail,
  ConversationRequest,
  MailDue,
} from '../contracts/conversation';
import type { MailMessage } from '../contracts/mailbox';
import {
  CATEGORY_LABEL,
  FAKE_OFFER,
  dueLabel,
  dueOrWords,
  requestPastDue,
  snippetText,
} from './mails';
import { MISSED } from './missed';
import { splitQuote } from './sandbox';

/** A conversation folds its older mails to one line each once it has more than this many. */
export const OPEN_MAILS = 3;

/** The day line above a group of mails: "Today", "Yesterday", "Fri 16 Oct". */
export function dayLabel(iso: string | null): string {
  if (!iso) return 'Date unknown';
  const date = new Date(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, isThisYear(date) ? 'EEE d MMM' : 'EEE d MMM yyyy');
}

/** The mails folded when the page opens: all but the newest few of a long conversation. */
export function initiallyFolded(messageIds: readonly string[]): Set<string> {
  if (messageIds.length <= OPEN_MAILS) return new Set();
  return new Set(messageIds.slice(0, messageIds.length - OPEN_MAILS));
}

/** What the AI read from one Gmail message, when it read that message. */
export function readingFor(
  gmailMessageId: string,
  mails: readonly ConversationMail[],
): ConversationMail | null {
  return mails.find((mail) => mail.gmailMessageId === gmailMessageId) ?? null;
}

/** The Gmail message whose mail asked for the current to-do. */
export function askingMessageId(detail: ConversationDetail): string | null {
  const emailId = detail.conversation.request?.emailId;
  if (!emailId) return null;
  return detail.mails.find((mail) => mail.id === emailId)?.gmailMessageId ?? null;
}

/**
 * The AI's reading in one line, in its own words where it gave any:
 * "Interview · Video · 14 Oct 11:00 · asks: confirm the time · due 13 Oct". A deadline the app
 * could read shows as a date in the user's own time (owner, 26 Nov 2026).
 */
export function readingSummary(mail: ConversationMail): string {
  const interview = [mail.interviewDate, mail.interviewTime].filter(Boolean).join(' ');
  // A fake offer asks for a payment: the line points to the warning instead of repeating it.
  const fake = mail.fakeOfferWarning !== null;
  const asked = dueOrWords(mail.actionDue, mail.actionDeadline);
  const due = fake ? mail.assessmentDeadline : asked || mail.assessmentDeadline;
  return [
    mail.category && CATEGORY_LABEL[mail.category],
    mail.interviewType || mail.interviewStage,
    interview,
    mail.offerInfo,
    fake && `${FAKE_OFFER.tag}, see the warning above`,
    !fake && mail.requestedAction && `asks: ${mail.requestedAction}`,
    due && `due ${due}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface KeyDate {
  label: string;
  value: string;
  /** The app could read it as a date: `value` is in the user's own time, not the mail's words. */
  own: boolean;
  /** "Missed" or "Past due", on the deadline of the request that is still open. */
  state: string | null;
}

/** Where the open request stands, for the date row of the mail that asks for it. */
function dueState(
  mail: ConversationMail | undefined,
  asked: ConversationRequest | null,
  kind: ConversationRequest['kind'],
): string | null {
  if (!mail || !asked || asked.emailId !== mail.id || asked.kind !== kind) return null;
  if (asked.missed) return MISSED.label;
  return requestPastDue(asked) ? 'Past due' : null;
}

const dateRow = (
  label: string,
  words: string | null | undefined,
  due: MailDue | null = null,
  state: string | null = null,
): KeyDate[] =>
  words ? [{ label, value: due ? dueLabel(due) : words, own: due !== null, state }] : [];

/**
 * The dates the mails name, newest mail first. A deadline the app could read is a date in the
 * user's own time (owner, 26 Nov 2026); the others stay as the mails wrote them: those are not
 * checked calendar times. `asked`: the conversation's request, so its deadline says when it is
 * past due or missed.
 */
export function keyDates(
  mails: readonly ConversationMail[],
  asked: ConversationRequest | null = null,
): KeyDate[] {
  const newestFirst = [...mails].reverse();
  const first = (pick: (mail: ConversationMail) => string | null) =>
    newestFirst.map(pick).find(Boolean) ?? null;
  const interview = first((mail) =>
    mail.interviewDate ? [mail.interviewDate, mail.interviewTime].filter(Boolean).join(', ') : null,
  );
  const replyBy = newestFirst.find((mail) => mail.actionDeadline);
  const followUp = newestFirst.find((mail) => mail.followUpDate);
  return [
    ...dateRow('Interview', interview),
    ...dateRow(
      'Assessment due',
      first((mail) => mail.assessmentDeadline),
    ),
    ...dateRow(
      'Reply by',
      replyBy?.actionDeadline,
      replyBy?.actionDue,
      dueState(replyBy, asked, 'ACTION'),
    ),
    ...dateRow(
      'Follow up',
      followUp?.followUpDate,
      followUp?.followUpDue,
      dueState(followUp, asked, 'FOLLOW_UP'),
    ),
  ];
}

/** The small line under the key dates: which of them are the user's own time. */
export function keyDatesNote(dates: readonly KeyDate[]): string {
  const own = dates.filter((date) => date.own).map((date) => date.label);
  if (own.length === dates.length) return 'In your own time.';
  if (own.length === 0) return 'As the mails wrote them.';
  return `${own.join(' and ')} in your own time. The rest as the mails wrote them.`;
}

/** "in 13 days", "today", "2 days late": how far a due date is from now. */
export function dueIn(deadline: string, now: Date): string {
  const days = differenceInCalendarDays(new Date(deadline), now);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return '1 day late';
  return `${-days} days late`;
}

/** Gmail, Apple Mail and Outlook mark the quoted earlier mail in their HTML this way. */
const HTML_QUOTE =
  /class=["'][^"']*gmail_quote|<blockquote[^>]+type=["']?cite|id=["']?(divRplyFwdMsg|appendonsend)/i;

export const hasHtmlQuote = (html: string): boolean => HTML_QUOTE.test(html);

/**
 * How to show a mail's text so its quoted earlier mail can be hidden. The HTML is used when it
 * marks its quote, or when the plain text has none either; otherwise the plain text is, since
 * only there can the quote be found.
 */
export function mailText(message: Pick<MailMessage, 'text' | 'html'>): {
  html: string | null;
  own: string;
  quoted: string | null;
  hasQuote: boolean;
} {
  const plain = splitQuote(message.text?.trim() ?? '');
  if (message.html && (hasHtmlQuote(message.html) || plain.quoted === null))
    return { html: message.html, ...plain, hasQuote: hasHtmlQuote(message.html) };
  return { html: null, ...plain, hasQuote: plain.quoted !== null };
}

/** A folded mail's one line: its own words, without the quoted earlier mail. */
export function mailPreview(message: Pick<MailMessage, 'text'>): string {
  const { own } = splitQuote(message.text?.trim() ?? '');
  return snippetText(own.replace(/\s+/g, ' ').trim());
}

/** Hides those quoted parts inside the mail frame until the user asks for them. */
export const HIDE_HTML_QUOTE_CSS =
  '.gmail_quote,blockquote[type="cite"],#divRplyFwdMsg,#divRplyFwdMsg~*,#appendonsend,#appendonsend~*{display:none!important}';

/**
 * The mail whose reading a phone shows under the next step: the one that asks for it, else the
 * newest the AI read.
 */
export function readingAbove(detail: ConversationDetail): ConversationMail | null {
  const asking = askingMessageId(detail);
  const read = detail.mails.filter((mail) => mail.gmailMessageId);
  return (
    (asking && read.find((mail) => mail.gmailMessageId === asking)) || read[read.length - 1] || null
  );
}
