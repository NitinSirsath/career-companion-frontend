import type { RingKind } from '../../lib/statusTags';

/**
 * Made-up applications and mails for the first run's pictures (approved mock), the way the product
 * site shows the app. Only the Gmail and Done steps show the user's own mails.
 */
export const SAMPLE_APPS: readonly {
  company: string;
  role: string;
  ring: RingKind;
  next: string;
}[] = [
  {
    company: 'ARC Advisory',
    role: 'React Front-End Developer',
    ring: 'interview',
    next: 'Interview Fri 11:00',
  },
  { company: 'Linear', role: 'Product Engineer', ring: 'recruiter', next: 'Reply to Sara' },
  { company: 'Vercel', role: 'Frontend Engineer', ring: 'assessment', next: 'Take-home due Mon' },
  { company: 'Notion', role: 'Software Engineer', ring: 'applied', next: 'Applied 2 days ago' },
  { company: 'Stripe', role: 'UI Engineer', ring: 'offer', next: 'Offer · reply by 28 Nov' },
];

export const SAMPLE_INBOX = [
  { from: 'Sara Kim', subject: 'Quick chat next week?', time: '9:12', unread: true },
  { from: 'Priya at ARC', subject: 'Interview invite', time: '8:40', unread: true },
  { from: 'Vercel Careers', subject: 'Your take-home task', time: 'Mon', unread: false },
  { from: 'Notion', subject: 'Thanks for applying', time: 'Sun', unread: false },
] as const;

/** Phone rows of the Mails list: who, the subject, the next step. */
export const SAMPLE_MAIL_ROWS = [
  {
    from: 'Priya Nair',
    subject: 'Interview invitation: Frontend Engineer',
    next: '→ Choose an interview time · Due Mon',
  },
  {
    from: 'Kestrel Hiring',
    subject: 'Your take-home test',
    next: '→ Finish the coding test · Due Thu',
  },
  { from: 'Sara Kim', subject: 'Quick chat next week?', next: '→ Reply to Sara' },
] as const;

export const SAMPLE_FLOW = [
  { from: 'Sara at Linear', subject: 'Quick chat next week?', tint: 'lilac' },
  { from: 'ARC Advisory', subject: 'Interview invite: Friday 11:00', tint: 'sand' },
  { from: 'Vercel Careers', subject: 'Your take-home task', tint: 'sage' },
] as const;

export const SAMPLE_REPLY = {
  laptop: {
    to: 'Reply to Sara Kim · Linear',
    text: 'Hi Sara, thanks for reaching out. Next Tuesday or Wednesday afternoon works well for me. My notice period is 30 days.',
  },
  phone: {
    to: 'Reply to Priya Nair',
    text: 'Hi Priya, Tuesday at 11:00 AM works well for me. Looking forward to it.',
  },
} as const;
