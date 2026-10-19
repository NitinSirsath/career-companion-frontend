import type { ApplicationStatus } from '../contracts/application';

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  RECRUITER_CONTACT: 'Recruiter contact',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};
