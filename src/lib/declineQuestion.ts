import type { DeclineQuestion } from '../contracts/application';
import { mailDate } from './mails';

/**
 * "Close the application?" after the user declined by mail (owner, 17 Nov 2026): the reply said
 * they no longer want the job, so the app asks first and closes it by itself three days later.
 */
export const DECLINE_QUESTION =
  'Your reply says you no longer want this job. Close the application?';

/** When it closes by itself, or why it no longer does. */
export function declineNote(decline: DeclineQuestion): string {
  return decline.closesAt
    ? `Closes by itself on ${mailDate(decline.closesAt)} if you do nothing.`
    : 'They wrote again, so it does not close by itself.';
}

/** Beside the status once it closed that way. */
export const closedAfterDeclineLine = (closedAt: string) =>
  `Closed after you declined by mail · ${mailDate(closedAt)}`;
