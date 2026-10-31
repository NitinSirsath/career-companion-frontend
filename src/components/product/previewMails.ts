import type { ApplicationStatus } from '../../contracts/application';
import type { MailCategory, RequestState } from '../../contracts/conversation';

/** One made-up mail of the product page's example list, in the Mails page's columns. */
export interface PreviewMail {
  subject: string;
  /** The line under the subject: sender, company and how many mails. */
  summary: string;
  category: MailCategory;
  fakeOffer?: boolean;
  step: string;
  due?: string;
  state: RequestState;
  /** The linked application; none for the fake offer. */
  application?: { status: ApplicationStatus; job: string };
  date: string;
  isNew?: boolean;
}

/** Made-up companies and people, one mail per kind of step the app shows. */
export const PREVIEW_MAILS: readonly PreviewMail[] = [
  {
    subject: 'Interview invitation: Frontend Engineer',
    summary: 'Priya Nair · Brightwave · 2 mails',
    category: 'INTERVIEW',
    step: 'Choose an interview time',
    due: 'By Mon, Nov 3',
    state: 'OPEN',
    application: { status: 'INTERVIEW', job: 'Brightwave · Frontend Engineer' },
    date: 'Today, 9:12 AM',
    isNew: true,
  },
  {
    subject: 'Your take-home test',
    summary: 'Kestrel Hiring · Kestrel Labs · 1 mail',
    category: 'ASSESSMENT',
    step: 'Finish the coding test',
    due: 'By Thu, Nov 6',
    state: 'OPEN',
    application: { status: 'ASSESSMENT', job: 'Kestrel Labs · React Developer' },
    date: 'Yesterday',
    isNew: true,
  },
  {
    subject: 'Congratulations! Your offer letter is ready',
    summary: 'HR Team · Zentrix Global · 1 mail',
    category: 'OFFER',
    fakeOffer: true,
    step: "Don't pay. Check the job on the company's own site.",
    state: 'OPEN',
    date: 'Oct 29',
  },
  {
    subject: 'Quick chat about a React role?',
    summary: 'Daniel Ortiz · Lumen Health · 3 mails',
    category: 'RECRUITER',
    step: 'Send your notice period',
    state: 'REPLIED',
    application: { status: 'RECRUITER_CONTACT', job: 'Lumen Health · Frontend Developer' },
    date: 'Oct 28',
  },
  {
    subject: 'Update on your application',
    summary: 'Orbitly Careers · Orbitly · 1 mail',
    category: 'REJECTION',
    step: 'Nothing to do',
    state: 'DONE',
    application: { status: 'REJECTED', job: 'Orbitly · UI Engineer' },
    date: 'Oct 27',
  },
];
