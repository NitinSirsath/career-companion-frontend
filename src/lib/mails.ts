import { format, isThisYear, isToday, isYesterday } from 'date-fns';
import { z } from 'zod';
import { isApiError } from '../api/client';
import {
  ApplicationChoiceDetailsSchema,
  ConversationFiltersSchema,
  type ApplicationChoiceDetails,
  type Conversation,
  type ConversationFilters,
  type ConversationMail,
  type ConversationRequest,
  type ListConversationsResponse,
  type MailCategory,
  type RequestClosedReason,
  type RequestState,
} from '../contracts/conversation';
import {
  mailboxKey,
  splitMailAddresses,
  type MailAttachment,
  type MailMessage,
} from '../contracts/mailbox';
import { deadlineLabel, deadlineOverdue } from './deadline';

/** What the user reads for each mail type. A confirmation or status mail is an "Update". */
export const CATEGORY_LABEL: Record<MailCategory, string> = {
  RECRUITER: 'Recruiter',
  INTERVIEW: 'Interview',
  ASSESSMENT: 'Assessment',
  OFFER: 'Offer',
  REJECTION: 'Rejection',
  FOLLOW_UP: 'Update',
  NEWSLETTER: 'Other',
  SPAM: 'Other',
};

/** The types offered as a filter, in the order a job search usually runs. */
const TYPE_FILTERS: MailCategory[] = [
  'RECRUITER',
  'INTERVIEW',
  'ASSESSMENT',
  'OFFER',
  'REJECTION',
  'FOLLOW_UP',
];

export const REQUEST_STATE_LABEL: Record<RequestState, string> = {
  OPEN: 'Needs action',
  REPLIED: 'Replied',
  DONE: 'Done',
};

/**
 * What the app says when the AI thinks a job mail is a fake offer that asks for money. It is a
 * warning, not an error: the AI can be wrong, so the mail stays and the user decides.
 */
export const FAKE_OFFER = {
  tag: 'Probably fake',
  title: 'This looks like a fake job offer',
  advice:
    "Real employers don't ask you to pay to get a job. Don't pay, and don't send bank or ID details. Check the job on the company's own careers site.",
  note: 'The AI noticed this in the mail. It can be wrong. The mail stays here so you can decide.',
  stepNote: 'Written by NorthList, not taken from the mail.',
} as const;

/**
 * True while a fake-offer conversation's next step is open: the warning then stands in for
 * "Needs action", because the step is the app's own advice, not what the mail asks.
 */
export const fakeOfferStep = (
  conversation: Pick<Conversation, 'fakeOfferWarning' | 'request'>,
): boolean => conversation.fakeOfferWarning !== null && conversation.request?.state === 'OPEN';

export const ACTION_FILTERS = [
  { value: 'open', label: REQUEST_STATE_LABEL.OPEN },
  { value: 'replied', label: REQUEST_STATE_LABEL.REPLIED },
  { value: 'done', label: REQUEST_STATE_LABEL.DONE },
  { value: 'none', label: 'Nothing needed' },
] as const;

export const APPLICATION_FILTERS = [
  { value: 'any', label: 'Has an application' },
  { value: 'none', label: 'No application yet' },
] as const;

export const TYPE_OPTIONS = TYPE_FILTERS.map((value) => ({ value, label: CATEGORY_LABEL[value] }));

/** "Needs action first" is the order when nothing is chosen. */
export const SORT_OPTIONS = [{ value: 'newest', label: 'Newest first' }] as const;

const { request, category, sort } = ConversationFiltersSchema.shape;

/**
 * What the Mails page keeps in its URL, so Back returns to the same view. A value the page does
 * not know is dropped instead of breaking the page.
 */
export const mailsSearchSchema = z.object({
  tab: z.literal('gmail').optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  request: request.catch(undefined),
  category: category.catch(undefined),
  application: z.enum(['any', 'none']).optional().catch(undefined),
  unseen: z.literal(true).optional().catch(undefined),
  sort: sort.catch(undefined),
  offset: z.number().int().positive().optional().catch(undefined),
});
export type MailsSearch = z.infer<typeof mailsSearchSchema>;

export function filtersFromSearch(search: MailsSearch): ConversationFilters {
  return {
    q: search.q?.trim() || undefined,
    request: search.request,
    category: search.category,
    application: search.application,
    unseen: search.unseen ? 'true' : undefined,
    sort: search.sort,
  };
}

/** "7", or "20+" when the page is full and more follow. */
export const pageCount = (page: ListConversationsResponse): string =>
  `${page.items.length}${page.metadata.nextOffset != null ? '+' : ''}`;

/** `"Priya Nair" <priya@northwind.example>` as the name and the address apart. */
export function parseSender(raw: string | null): { name: string; address: string | null } {
  const text = raw?.trim();
  if (!text) return { name: 'Unknown sender', address: null };
  const match = text.match(/^"?([^"<]*?)"?\s*<([^<>]+)>$/);
  if (!match) return { name: text, address: null };
  const name = match[1].trim();
  return name ? { name, address: match[2].trim() } : { name: match[2].trim(), address: null };
}

/** The names on a To or Cc line, in order. `without` leaves the people of one mailbox out. */
export function recipientNames(line: string | null, without: string | null = null): string[] {
  const left = without ? mailboxKey(without) : null;
  return splitMailAddresses(line ?? '')
    .filter((entry) => mailboxKey(entry) !== left)
    .map((entry) => parseSender(entry).name);
}

const recipients = (to: string[], cc: string[]): string | null => {
  if (!to.length) return null;
  return `to ${to.join(', ')}${cc.length ? ` · cc ${cc.join(', ')}` : ''}`;
};

/**
 * Who a message went to. Mail the user received starts with "to me", as Gmail shows it, and then
 * names the other people on it, so the user sees who a reply to all reaches. `mailbox` is the
 * user's own address: until it is known, nobody on the mail can be told apart from "me".
 */
export function recipientLine(
  message: Pick<MailMessage, 'sentByUser' | 'to' | 'cc'>,
  mailbox: string | null,
): string | null {
  if (message.sentByUser) return recipients(recipientNames(message.to), recipientNames(message.cc));
  if (!mailbox) return 'to me';
  return recipients(
    ['me', ...recipientNames(message.to, mailbox)],
    recipientNames(message.cc, mailbox),
  );
}

/** "4 mails · 2 from you": every message of the thread, and how many the user wrote. */
export function mailCounts(total: number, fromYou: number): string {
  const mails = `${total} mail${total === 1 ? '' : 's'}`;
  return fromYou > 0 ? `${mails} · ${fromYou} from you` : mails;
}

/** The line under a conversation's subject: sender, company and how many mails. */
export function conversationSummary(conversation: Conversation): string {
  return [
    parseSender(conversation.sender).name,
    conversation.company,
    mailCounts(conversation.mailCount + conversation.sentCount, conversation.sentCount),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Company · Role" as the AI read them; null when it read neither. */
export const companyAndRole = (conversation: Pick<Conversation, 'company' | 'role'>) =>
  [conversation.company, conversation.role].filter(Boolean).join(' · ') || null;

/** List date: the time for today, then only the day. */
export function mailDate(iso: string | null): string {
  if (!iso) return 'Date unknown';
  const date = new Date(iso);
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return 'Yesterday';
  return format(date, isThisYear(date) ? 'MMM d' : 'MMM d, yyyy');
}

/** Message date: always with the time. */
export function mailDateTime(iso: string | null): string {
  if (!iso) return 'Date unknown';
  const date = new Date(iso);
  const time = format(date, 'h:mm a');
  if (isToday(date)) return `Today, ${time}`;
  if (isYesterday(date)) return `Yesterday, ${time}`;
  return `${format(date, isThisYear(date) ? 'MMM d' : 'MMM d, yyyy')}, ${time}`;
}

/** What the mail asks for, in the AI's words when it gave any. */
export function requestTitle(asked: ConversationRequest): string {
  if (asked.text) return asked.text;
  return asked.kind === 'FOLLOW_UP' ? 'Follow up' : 'Action needed';
}

/** "You replied Today, 1:04 AM", the same on a mail and on its application's action. */
export const repliedLine = (repliedAt: string) => `You replied ${mailDate(repliedAt)}`;

/** Why a step closed, in the user's words (owner, 24 Oct 2026). */
export const CLOSED_REASON_LABEL: Record<RequestClosedReason, string> = {
  REPLACED_BY_MAIL: 'Replaced by a newer mail',
  CONFIRMED_BY_MAIL: 'A newer mail confirmed it',
  YOUR_REPLY: 'Your reply answered it',
  YOU_SAID_DONE: 'You said you did it',
  APPLICATION_CLOSED: 'Closed with the application',
};

/** An open request whose deadline has passed: it stays open and says so. */
export const requestPastDue = (asked: ConversationRequest, now = new Date()) =>
  asked.state === 'OPEN' && deadlineOverdue(asked, now);

/** The line beside the state: when it is due or was due, when the user replied, or why it closed. */
export function requestDetail(asked: ConversationRequest): string | null {
  if (asked.state === 'REPLIED') return asked.repliedAt ? repliedLine(asked.repliedAt) : null;
  if (asked.state === 'DONE') return asked.closedReason && CLOSED_REASON_LABEL[asked.closedReason];
  if (!asked.deadline) return null;
  return `${requestPastDue(asked) ? 'Past due ·' : 'Due'} ${deadlineLabel(asked)}`;
}

/**
 * Only a request done outside mail closes by hand: "I did this" (owner, 24 Oct 2026). One read
 * before the AI said how it is done may be closed by hand too.
 */
export const closesByHand = (asked: Pick<ConversationRequest, 'askKind'>) =>
  asked.askKind !== 'REPLY_BY_MAIL';

export interface RequestControl {
  label: string;
  state: 'DONE' | 'OPEN';
}

/**
 * What the user can change on a request, in the "⋯" menus and the phone swipe. There is no "Mark
 * done": a reply or a newer mail closes a request by itself (owner, 24 Oct 2026).
 */
export function requestControls(asked: ConversationRequest): RequestControl[] {
  if (asked.state === 'OPEN')
    return closesByHand(asked) ? [{ label: 'I did this', state: 'DONE' }] : [];
  if (asked.state === 'DONE') return [{ label: 'Reopen', state: 'OPEN' }];
  return [{ label: 'Ask me again', state: 'OPEN' }];
}

/**
 * What a conversation that asks for nothing still tells: an interview or an assessment date, in
 * the mail's own words. They are not checked calendar times.
 */
export function scheduleLine(
  conversation: Pick<Conversation, 'interview' | 'assessmentDeadline'>,
): string | null {
  const when = [conversation.interview?.date, conversation.interview?.time]
    .filter(Boolean)
    .join(', ');
  if (when) return `Interview: ${when}`;
  return conversation.assessmentDeadline
    ? `Assessment due ${conversation.assessmentDeadline}`
    : null;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind({ mimeType, filename }: MailAttachment): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'Image';
  const extension = filename.includes('.') ? filename.split('.').pop() : '';
  return extension ? extension.toUpperCase() : 'File';
}

/** "PDF · 184 KB" */
export const attachmentInfo = (attachment: MailAttachment): string =>
  `${fileKind(attachment)} · ${fileSize(attachment.size)}`;

/** What the AI read from one mail, as label and value. Fields it left empty are left out. */
export function aiReading(mail: ConversationMail): { label: string; value: string }[] {
  const fake = mail.fakeOfferWarning !== null;
  const rows: [string, (string | null)[]][] = [
    ['Type', [mail.category && CATEGORY_LABEL[mail.category]]],
    ['Company', [mail.company]],
    ['Role', [mail.role]],
    ['Warning', [mail.fakeOfferWarning]],
    ['Recruiter', [mail.recruiterName, mail.recruiterEmail]],
    [
      'Interview',
      [mail.interviewStage, mail.interviewType, mail.interviewDate, mail.interviewTime],
    ],
    ['Assessment', [mail.assessmentInfo, mail.assessmentDeadline]],
    ['Offer', [mail.offerInfo]],
    ['Rejection', [mail.rejectionInfo]],
    // A fake offer's request is a payment: never shown as something to do.
    ['Asked for', [fake ? null : mail.requestedAction]],
    ['Deadline', [fake ? null : mail.actionDeadline]],
    ['Follow up', [mail.followUpDate]],
  ];
  return rows.flatMap(([label, parts]) => {
    const value = parts.filter(Boolean).join(', ');
    return value ? [{ label, value }] : [];
  });
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Gmail sends the start of a mail with HTML entities; show the characters they stand for. */
export function snippetText(snippet: string): string {
  return snippet.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity: string, code: string) => {
    if (code[0] !== '#') return ENTITIES[code.toLowerCase()] ?? entity;
    const hex = code[1].toLowerCase() === 'x';
    const point = parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
    return point <= 0x10ffff ? String.fromCodePoint(point) : entity;
  });
}

/** True when the fix for a failed Gmail read is on the Gmail Sync page. */
export const needsGmailConnection = (error: unknown): boolean =>
  isApiError(error) && error.code === 'GMAIL_NOT_CONNECTED';

/** What the Application cell does after "Create application" was refused. */
export type LinkProblem =
  | { kind: 'company' }
  | { kind: 'choice'; candidates: ApplicationChoiceDetails['candidates'] }
  | { kind: 'message'; text: string };

export function linkProblem(error: unknown): LinkProblem {
  if (isApiError(error)) {
    if (error.code === 'COMPANY_REQUIRED') return { kind: 'company' };
    const choice = ApplicationChoiceDetailsSchema.safeParse(error.details);
    if (error.code === 'APPLICATION_CHOICE_REQUIRED' && choice.success)
      return { kind: 'choice', candidates: choice.data.candidates };
    if (error.code === 'CONVERSATION_LINKED')
      return { kind: 'message', text: 'This conversation already has an application.' };
  }
  const reason = error instanceof Error ? error.message : 'Something went wrong.';
  return { kind: 'message', text: `Could not create the application: ${reason}` };
}
