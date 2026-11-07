import { useEffect, useState } from 'react';
import type { TagColor } from './statusTags';

/** A made-up mail in the sign-in page's picture of the Mails list. */
export type PictureMail = {
  sender: string;
  subject: string;
  /** The next step; empty for "Nothing needed". */
  step: string;
  due?: { text: string; late?: boolean };
  meta: string;
  /** The grey line while the AI still reads the mail: only the sender is known. */
  readingMeta?: string;
  app?: { company: string; role: string; status: string; color: TagColor };
  date: string;
};

/** The mails the picture starts with, the same as on the approved mock (owner, 3 Nov 2026). */
export const START_MAILS: PictureMail[] = [
  {
    sender: 'Riya Kapoor',
    subject: 'Frontend Developer opportunity at Lumen Apps',
    step: 'Reply with a suitable time for a 20-minute call next week',
    meta: 'Riya Kapoor · Lumen Apps · Recruiter · 1 mail',
    date: 'Oct 22',
  },
  {
    sender: 'Maya Chen',
    subject: 'Re: Interview for the Data Analyst role at BrightPath',
    step: 'Let them know your decision regarding the offer',
    due: { text: 'Due Nov 10' },
    meta: 'Maya Chen · BrightPath Analytics · Offer · 5 mails, 2 from you',
    app: { company: 'BrightPath Analytics', role: 'Data Analyst', status: 'Offer', color: 'green' },
    date: 'Oct 22',
  },
  {
    sender: 'Arjun Mehta',
    subject: 'Next step: technical interview at Quanta Labs',
    step: 'Confirm availability for the technical interview',
    due: { text: 'Past due, Oct 22', late: true },
    meta: 'Arjun Mehta · Quanta Labs · Interview · 1 mail',
    app: { company: 'Quanta Labs', role: 'Backend Engineer', status: 'Interview', color: 'blue' },
    date: 'Oct 21',
  },
  {
    sender: 'Quanta Labs Hiring',
    subject: 'Online coding assessment for Backend Engineer',
    step: 'Complete the online coding assessment',
    due: { text: 'Past due, Oct 30', late: true },
    meta: 'Quanta Labs Hiring · Quanta Labs · Assessment · 1 mail',
    app: { company: 'Quanta Labs', role: 'Backend Engineer', status: 'Interview', color: 'blue' },
    date: 'Oct 20',
  },
  {
    sender: 'Harbor Lane Careers',
    subject: 'Your application for Product Designer at Harbor Lane',
    step: '',
    meta: 'Harbor Lane Careers · Harbor Lane · Rejection · 1 mail',
    app: { company: 'Harbor Lane', role: 'Product Designer', status: 'Rejected', color: 'red' },
    date: 'Oct 16',
  },
];

/** The two mails that come in after the page opens (owner, 7 Nov 2026). */
export const NEW_MAILS: PictureMail[] = [
  {
    sender: 'Priya Nair',
    subject: 'Interview invite: Frontend Engineer at Northwind Labs',
    step: 'Pick a time for the first interview',
    due: { text: 'Due Nov 12' },
    meta: 'Priya Nair · Northwind Labs · Interview · 1 mail',
    readingMeta: 'Priya Nair · 1 mail',
    app: {
      company: 'Northwind Labs',
      role: 'Frontend Engineer',
      status: 'Interview',
      color: 'blue',
    },
    date: 'Nov 7',
  },
  {
    sender: 'Cedar Talent',
    subject: 'Update on your UI Engineer application',
    step: '',
    meta: 'Cedar Talent · Kestrel Health · Rejection · 1 mail',
    readingMeta: 'Cedar Talent · 1 mail',
    app: { company: 'Kestrel Health', role: 'UI Engineer', status: 'Rejected', color: 'red' },
    date: 'Nov 7',
  },
];

/**
 * Steps of the picture: 0 the start; then for each new mail "it came in, the AI reads it" and
 * "read". The wait before each next step, in ms: the first mail comes after 1.8 s, each is read in
 * 2.2 s, and the second comes 4.8 s after the first was read. Then nothing more moves.
 */
export const PICTURE_STEP_WAITS_MS = [1800, 2200, 4800, 2200];
export const LAST_PICTURE_STEP = PICTURE_STEP_WAITS_MS.length;

export type PictureRow = { mail: PictureMail; reading: boolean; arrived: boolean };

/** What the picture shows at a step: the rows, newest first, and the two counts. */
export function pictureAt(step: number): {
  rows: PictureRow[];
  needYou: number;
  jobMails: number;
} {
  const arrived = NEW_MAILS.filter((_, i) => step >= i * 2 + 1);
  const newRows = arrived
    .map((mail, i) => ({ mail, reading: step === i * 2 + 1, arrived: true }))
    .reverse();
  const rows = [
    ...newRows,
    ...START_MAILS.map((mail) => ({ mail, reading: false, arrived: false })),
  ];
  return {
    rows,
    needYou: rows.filter((row) => !row.reading && row.mail.step).length,
    jobMails: rows.length,
  };
}

/**
 * The picture's step, moving on by itself until the last one. With "reduce motion" on the
 * computer it stays at the start.
 */
export function usePictureStep(): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= LAST_PICTURE_STEP) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => setStep(step + 1), PICTURE_STEP_WAITS_MS[step]);
    return () => window.clearTimeout(timer);
  }, [step]);
  return step;
}
