import type { ApplicationStatus } from '../contracts/application';

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: 'Application Received',
  RECRUITER_CONTACT: 'Recruiter Contact',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

