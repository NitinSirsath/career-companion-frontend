import type { ApplicationResponse, ApplicationStatus } from '../contracts/application';
import { STATUS_LABEL } from './statusLabels';

export type TagColor = 'gray' | 'blue' | 'cyan' | 'teal' | 'green' | 'red' | 'yellow' | 'outline';

export interface TagLook {
  label: string;
  color: TagColor;
}

/**
 * One colour per application status, in job-search order. Colour carries meaning only here: the
 * user's to-do state and the mail type never reuse these looks.
 */
export const STATUS_TAG_COLOR: Record<ApplicationStatus, TagColor> = {
  APPLIED: 'gray',
  RECRUITER_CONTACT: 'cyan',
  ASSESSMENT: 'teal',
  INTERVIEW: 'blue',
  OFFER: 'green',
  REJECTED: 'red',
  CLOSED: 'outline',
};

export const STATUS_UNKNOWN_TAG: TagLook = { label: 'Status unknown', color: 'outline' };
export const SENT_BY_AUTOMATION_TAG: TagLook = { label: 'Sent by automation', color: 'outline' };
export const ARCHIVED_TAG: TagLook = { label: 'Archived', color: 'outline' };

export function statusTag(status: ApplicationStatus | null): TagLook {
  if (!status) return STATUS_UNKNOWN_TAG;
  return { label: STATUS_LABEL[status], color: STATUS_TAG_COLOR[status] };
}

/**
 * The tag an application shows. An automation submission with no status yet says so instead of
 * a status (ADR-0002 decision 8); once a status exists, the status wins.
 */
export function applicationTag(
  app: Pick<ApplicationResponse, 'statusSource' | 'submittedVia' | 'effectiveStatus'>,
): TagLook {
  if (app.statusSource === 'UNKNOWN' && app.submittedVia === 'AUTOMATION') {
    return SENT_BY_AUTOMATION_TAG;
  }
  return statusTag(app.effectiveStatus);
}
