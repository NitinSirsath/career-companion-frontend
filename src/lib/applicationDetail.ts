import { format, isValid } from 'date-fns';
import type {
  ApplicationActionListItem,
  ApplicationEventResponse,
  ApplicationResponse,
  ApplicationStatus,
} from '../contracts/application';
import { AUTOMATION_SUBMITTED, platformLabel } from './eventLabels';
import { parseSender } from './mails';
import { STATUS_LABEL } from './statusLabels';

/** A date the server sent, or "Date unknown" when it sent none it can read. */
function safeFormat(value: string | Date, pattern: string): string {
  const date = new Date(value);
  return isValid(date) ? format(date, pattern) : 'Date unknown';
}

export const longDate = (value: string | Date) => safeFormat(value, 'EEE d MMM yyyy');
export const dateAndTime = (value: string | Date) => safeFormat(value, 'EEE d MMM yyyy, h:mm a');

/** Who set the status shown, in a few words beside it. */
export function statusSourceLine(
  app: Pick<
    ApplicationResponse,
    'statusSource' | 'submittedVia' | 'userStatusSetAt' | 'effectiveStatus'
  >,
): string {
  if (app.statusSource === 'USER')
    return app.userStatusSetAt
      ? `Set by you · ${longDate(app.userStatusSetAt)}`
      : 'Set by you · date unknown';
  if (app.statusSource === 'AI') return 'Set by the AI from your mails';
  if (app.submittedVia === 'AUTOMATION') return 'Reported by your automation';
  return 'No status yet';
}

/** "Interview scheduled", when the action has no words of its own: from its type. */
function typeWords(type: string): string {
  const words = type.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const stepText = (action: Pick<ApplicationActionListItem, 'description' | 'type'>) =>
  action.description || typeWords(action.type);

/** The mails the page knows, by id: from the history it has loaded. */
export function mailSenders(events: readonly ApplicationEventResponse[]): Map<string, string> {
  const senders = new Map<string, string>();
  for (const event of events)
    if (event.sourceEmail?.sender)
      senders.set(event.sourceEmail.id, parseSender(event.sourceEmail.sender).name);
  return senders;
}

/** Where a step came from: "From Arjun Mehta's mail", "Your own follow-up", or nothing. */
export function stepSource(
  action: Pick<ApplicationActionListItem, 'origin' | 'emailId'>,
  senders: ReadonlyMap<string, string>,
): { text: string; mailId: string | null } | null {
  if (action.origin === 'USER') return { text: 'Your own follow-up', mailId: null };
  if (!action.emailId) return null;
  const sender = senders.get(action.emailId);
  return { text: sender ? `From ${sender}'s mail` : 'From a mail', mailId: action.emailId };
}

/** The people who wrote this application's mails, each once, newest first. */
export function mailPeople(
  events: readonly ApplicationEventResponse[],
): { name: string; address: string | null }[] {
  const people = new Map<string, { name: string; address: string | null }>();
  for (const event of events) {
    if (!event.sourceEmail?.sender || event.retiredAt) continue;
    const person = parseSender(event.sourceEmail.sender);
    const key = (person.address ?? person.name).toLowerCase();
    if (!people.has(key)) people.set(key, person);
  }
  return [...people.values()];
}

const label = (status: ApplicationStatus) => STATUS_LABEL[status];

/** What the AI did to the status with this mail, in a sentence. */
export function aiStatusWords(
  event: Pick<ApplicationEventResponse, 'oldState' | 'newState'>,
): string | null {
  const { oldState, newState } = event;
  if (oldState && newState && oldState === newState)
    return `The AI kept the status at ${label(newState)}`;
  if (oldState && newState)
    return `The AI moved the status from ${label(oldState)} to ${label(newState)}`;
  if (newState) return `The AI set the status to ${label(newState)}`;
  if (oldState) return `The AI cleared the status ${label(oldState)}`;
  return null;
}

export interface HistoryEntry {
  title: string;
  /** The mail this entry is about, when it is still there. */
  mailId: string | null;
  detail: string | null;
  kind: 'mail' | 'automation' | 'other';
}

/** One history row in plain words: what happened, and what it changed. */
export function historyEntry(event: ApplicationEventResponse): HistoryEntry {
  if (event.type === AUTOMATION_SUBMITTED) {
    const submission = event.sourceSubmission;
    return {
      title: 'Sent by your automation',
      mailId: null,
      detail: submission
        ? [platformLabel(submission.platform), submission.destinationHost]
            .filter(Boolean)
            .join(' · ')
        : 'Submission details unavailable',
      kind: 'automation',
    };
  }
  const source = event.sourceEmail;
  if (event.type === 'EMAIL_PROCESSED' || source) {
    const subject = source?.subject || '(No subject)';
    return {
      title: source
        ? `Mail from ${parseSender(source.sender).name}: ${subject}`
        : 'A job mail (details unavailable)',
      mailId: source?.id ?? null,
      detail: event.retiredAt ? null : aiStatusWords(event),
      kind: 'mail',
    };
  }
  return {
    title: typeWords(event.type),
    mailId: null,
    detail: event.retiredAt ? null : aiStatusWords(event),
    kind: 'other',
  };
}

/** Why a history row no longer counts. */
export function retiredLine(event: ApplicationEventResponse): string | null {
  if (!event.retiredAt) return null;
  const what =
    event.retiredReason === 'EMAIL_MOVED'
      ? 'Moved to another application'
      : 'Unlinked from this application';
  return `${what} on ${longDate(event.retiredAt)}. It no longer counts toward the AI's status.`;
}
