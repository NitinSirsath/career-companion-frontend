import type { ApplicationResponse, ApplicationStatus } from '../contracts/application';
import { STATUS_LABEL } from './statusLabels';

export type TagColor = 'gray' | 'blue' | 'cyan' | 'teal' | 'green' | 'red' | 'yellow' | 'outline';

/** A plain label that is not a status, such as Archived. */
export interface TagLook {
  label: string;
  color: TagColor;
}

/**
 * The small status ring (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/`): how far an application
 * has come. Empty grey for Applied, a quarter blue for a recruiter, half yellow for a test, three
 * quarters orange for an interview, a green check for an offer, a grey × once it is over. `todo` is
 * a to-do's empty ring, not a status.
 */
export type RingKind =
  'applied' | 'recruiter' | 'assessment' | 'interview' | 'offer' | 'closed' | 'todo';

/** A status as it shows: its words and its ring. */
export interface StatusLook {
  label: string;
  ring: RingKind;
}

/** One ring per application status, in job-search order. The ring is the status's only colour. */
export const STATUS_RING: Record<ApplicationStatus, RingKind> = {
  APPLIED: 'applied',
  RECRUITER_CONTACT: 'recruiter',
  ASSESSMENT: 'assessment',
  INTERVIEW: 'interview',
  OFFER: 'offer',
  REJECTED: 'closed',
  CLOSED: 'closed',
};

export const STATUS_UNKNOWN_TAG: StatusLook = { label: 'Status unknown', ring: 'applied' };
/** NorthList Apply sent it and the company has not written yet (owner, 10 Nov 2026). */
export const SENT_BY_AUTOMATION_TAG: StatusLook = { label: 'No reply yet', ring: 'applied' };
export const ARCHIVED_TAG: TagLook = { label: 'Archived', color: 'outline' };

export function statusTag(status: ApplicationStatus | null): StatusLook {
  if (!status) return STATUS_UNKNOWN_TAG;
  return { label: STATUS_LABEL[status], ring: STATUS_RING[status] };
}

/**
 * The status an application shows. An automation submission with no status yet says so instead
 * of a status (ADR-0002 decision 8); once a status exists, the status wins.
 */
export function applicationTag(
  app: Pick<ApplicationResponse, 'statusSource' | 'submittedVia' | 'effectiveStatus'>,
): StatusLook {
  if (app.statusSource === 'UNKNOWN' && app.submittedVia === 'AUTOMATION') {
    return SENT_BY_AUTOMATION_TAG;
  }
  return statusTag(app.effectiveStatus);
}
