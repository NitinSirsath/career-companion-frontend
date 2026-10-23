import { differenceInCalendarDays, format, isThisYear, isToday, isYesterday } from 'date-fns';
import type { ConversationDetail, ConversationMail } from '../contracts/conversation';
import type { MailMessage } from '../contracts/mailbox';
import { CATEGORY_LABEL, FAKE_OFFER, snippetText } from './mails';
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
 * "Interview · Video · 14 Oct 11:00 · asks: confirm the time · due 13 Oct".
 */
export function readingSummary(mail: ConversationMail): string {
  const interview = [mail.interviewDate, mail.interviewTime].filter(Boolean).join(' ');
  // A fake offer asks for a payment: the line points to the warning instead of repeating it.
  const fake = mail.fakeOfferWarning !== null;
  const due = fake ? mail.assessmentDeadline : mail.actionDeadline || mail.assessmentDeadline;
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

/**
 * The dates the mails name, newest mail first, as the mails wrote them: these are not checked
 * calendar times.
 */
export function keyDates(mails: readonly ConversationMail[]): { label: string; value: string }[] {
  const newestFirst = [...mails].reverse();
  const first = (pick: (mail: ConversationMail) => string | null) =>
    newestFirst.map(pick).find(Boolean) ?? null;
  const interview = first((mail) =>
    mail.interviewDate ? [mail.interviewDate, mail.interviewTime].filter(Boolean).join(', ') : null,
  );
  const rows: [string, string | null][] = [
    ['Interview', interview],
    ['Assessment due', first((mail) => mail.assessmentDeadline)],
    ['Reply by', first((mail) => mail.actionDeadline)],
    ['Follow up', first((mail) => mail.followUpDate)],
  ];
  return rows.flatMap(([label, value]) => (value ? [{ label, value }] : []));
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
