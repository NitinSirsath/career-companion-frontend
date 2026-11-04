/*
 * The live example's made-up data: companies, mails and applications. Nothing here is real, and
 * nothing the visitor does in the example leaves the page.
 */
export type MailType = 'INTERVIEW' | 'ASSESSMENT' | 'OFFER' | 'RECRUITER' | 'REJECTION' | 'FOLLOW_UP';
export type Status = 'APPLIED' | 'RECRUITER_CONTACT' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER' | 'REJECTED';
export type View = 'dashboard' | 'mails' | 'applications' | 'mail';

export interface Message {
  from: string;
  email: string;
  when: string;
  body: string;
  fold?: boolean;
  you?: boolean;
}

export interface Mail {
  id: string;
  subject: string;
  from: string;
  email: string;
  company: string;
  type: MailType;
  step: string;
  due?: string;
  state: 'OPEN' | 'REPLIED' | 'DONE';
  app?: { status: Status; job: string };
  date: string;
  when: string;
  thread: Message[];
  isNew?: boolean;
  fake?: boolean;
  how?: 'link';
  choices?: string[];
  draft?: string;
  repliedAt?: string;
  /* Set while the example plays */
  reading?: boolean;
  fresh?: boolean;
  checking?: boolean;
  closed?: string;
  note?: string;
}

export interface Application {
  co: string;
  job: string;
  status: Status;
  todo: string;
  due?: string;
  applied: string;
  last: string;
  mail?: string;
}

export interface Reply {
  text: string;
  writing: boolean;
  sending?: boolean;
}

export interface State {
  view: View;
  mailId: string | null;
  reply: Reply | null;
  mails: Mail[];
  apps: Application[];
  syncing: boolean;
  synced: boolean;
  reading: boolean;
  syncedAt: string;
  /** The Mails list's quick filters: Needs action, New only */
  needsOnly: boolean;
  newOnly: boolean;
}

export const TYPE: Record<MailType, [string, string]> = {
  INTERVIEW: ['Interview', 'calendar'], ASSESSMENT: ['Assessment', 'code'], OFFER: ['Offer', 'offer'],
  RECRUITER: ['Recruiter', 'user'], REJECTION: ['Rejection', 'rejection'], FOLLOW_UP: ['Update', 'update'],
};
export const STATUS: Record<Status, [string, string]> = {
  APPLIED: ['Applied', 'gray'], RECRUITER_CONTACT: ['Recruiter contact', 'cyan'], ASSESSMENT: ['Assessment', 'teal'],
  INTERVIEW: ['Interview', 'blue'], OFFER: ['Offer', 'green'], REJECTED: ['Rejected', 'red'],
};

export const MAILS: Mail[] = [
  {
    id: 'brightwave', subject: 'Interview invitation: Frontend Engineer', from: 'Priya Nair', email: 'priya.nair@brightwave.example',
    company: 'Brightwave', type: 'INTERVIEW', step: 'Choose an interview time', due: 'By Mon, Nov 3', state: 'OPEN',
    app: { status: 'INTERVIEW', job: 'Frontend Engineer' }, date: '9:12 AM', isNew: true, when: 'Today, 9:12 AM',
    choices: ['Take Tue, Nov 4, 11:00 AM', 'Ask for another time'],
    draft: 'Hi Priya,\n\nThank you for the invitation. Tuesday, November 4 at 11:00 AM works well for me.\n\nI look forward to meeting the team.\n\nBest regards,\nAlex',
    thread: [
      { from: 'Brightwave Careers', email: 'careers@brightwave.example', when: 'Oct 14', fold: true, body: 'Thanks for applying for Frontend Engineer at Brightwave. Our team will review your application and get back to you.' },
      { from: 'Priya Nair', email: 'priya.nair@brightwave.example', when: 'Today, 9:12 AM', body: 'Hi Alex,\n\nThanks for your patience. We would like to invite you to a 45-minute video interview with our frontend team.\n\nCould you pick one of these times?\n• Tue, Nov 4, 11:00 AM\n• Wed, Nov 5, 3:00 PM\n• Thu, Nov 6, 10:00 AM\n\nPlease reply by Monday.\n\nBest,\nPriya' },
    ],
  },
  {
    id: 'kestrel', subject: 'Your take-home test', from: 'Kestrel Hiring', email: 'hiring@kestrel.example', company: 'Kestrel Labs',
    type: 'ASSESSMENT', step: 'Finish the coding test', due: 'By Thu, Nov 6', state: 'OPEN', app: { status: 'ASSESSMENT', job: 'React Developer' },
    date: 'Yesterday', isNew: true, when: 'Yesterday, 4:30 PM', how: 'link',
    choices: ['Confirm you will do it', 'Ask about the test'],
    draft: 'Hi,\n\nThank you for sending the test. I will submit it before Thursday, November 6.\n\nBest regards,\nAlex',
    thread: [{ from: 'Kestrel Hiring', email: 'hiring@kestrel.example', when: 'Yesterday, 4:30 PM', body: 'Hi Alex,\n\nThe next step for the React Developer role is a short take-home test. It takes about two hours. Please submit it through the link in this mail by Thursday, November 6.\n\nGood luck!\nKestrel Hiring' }],
  },
  {
    id: 'zentrix', subject: 'Congratulations! Your offer letter is ready', from: 'HR Team', email: 'offers@zentrix-global.example', company: 'Zentrix Global',
    type: 'OFFER', fake: true, step: "Don't pay. Check this job on the company's own careers site.", state: 'OPEN', date: 'Oct 29', when: 'Oct 29, 8:05 PM',
    choices: ['Decline politely', 'Ask for the official job page'],
    draft: 'Hello,\n\nThank you. I do not pay fees to apply for a job. Please share the official job page on your company\'s careers site.\n\nAlex',
    thread: [{ from: 'HR Team', email: 'offers@zentrix-global.example', when: 'Oct 29, 8:05 PM', body: 'Dear Candidate,\n\nYou have been selected for the post of Software Engineer with a salary of $120,000. To confirm your joining, please pay a refundable registration fee of $250 within 24 hours.\n\nRegards,\nHR Team' }],
  },
  {
    id: 'lumen', subject: 'Quick chat about a React role?', from: 'Daniel Ortiz', email: 'daniel@lumenhealth.example', company: 'Lumen Health',
    type: 'RECRUITER', step: 'Send your notice period', state: 'REPLIED', app: { status: 'RECRUITER_CONTACT', job: 'Frontend Developer' }, date: 'Oct 28', when: 'Oct 28, 11:20 AM',
    repliedAt: 'Oct 28, 2:02 PM', choices: ['Suggest a time to talk', 'Ask about the team'],
    draft: 'Hi Daniel,\n\nI am free on Wednesday after 2 PM or Thursday morning. Would either work for a call?\n\nBest,\nAlex',
    thread: [
      { from: 'Daniel Ortiz', email: 'daniel@lumenhealth.example', when: 'Oct 27', fold: true, body: 'Hi Alex, I came across your profile and think you could be a great fit for a Frontend Developer role at Lumen Health. Open to a quick chat?' },
      { from: 'Daniel Ortiz', email: 'daniel@lumenhealth.example', when: 'Oct 28, 11:20 AM', body: 'Great to hear from you, Alex. Before I share your profile with the team, what is your notice period?\n\nThanks,\nDaniel' },
      { you: true, from: 'You', email: 'alex.morgan@gmail.example', when: 'Oct 28, 2:02 PM', body: 'Hi Daniel, my notice period is 30 days. Happy to talk this week.\n\nAlex' },
    ],
  },
  {
    id: 'orbitly', subject: 'Update on your application', from: 'Orbitly Careers', email: 'careers@orbitly.example', company: 'Orbitly',
    type: 'REJECTION', step: 'Nothing to do', state: 'DONE', app: { status: 'REJECTED', job: 'UI Engineer' }, date: 'Oct 27', when: 'Oct 27, 10:00 AM',
    choices: ['Thank them', 'Ask for feedback'],
    draft: 'Hi,\n\nThank you for letting me know. I would be grateful for any feedback on my application.\n\nBest regards,\nAlex',
    thread: [{ from: 'Orbitly Careers', email: 'careers@orbitly.example', when: 'Oct 27, 10:00 AM', body: 'Hi Alex,\n\nThank you for your interest in the UI Engineer role. After careful review, we have decided to move forward with other candidates.\n\nWe wish you the best in your search.\nOrbitly Careers' }],
  },
];
export const NEW_MAIL: Mail = {
  id: 'fernhill', subject: 'Free for a 15-minute call this week?', from: 'Meera Shah', email: 'meera@fernhill.example', company: 'Fernhill',
  type: 'RECRUITER', step: 'Suggest a time for a call', due: 'By Fri, Nov 7', state: 'OPEN', app: { status: 'RECRUITER_CONTACT', job: 'Product Engineer' },
  date: 'Just now', isNew: true, when: 'Just now', choices: ['Offer Wed afternoon', 'Ask what the role is'],
  draft: 'Hi Meera,\n\nThanks for reaching out. I would be glad to talk. Wednesday afternoon works for me, any time after 2 PM.\n\nBest,\nAlex',
  thread: [{ from: 'Meera Shah', email: 'meera@fernhill.example', when: 'Just now', body: 'Hi Alex,\n\nThanks for applying for Product Engineer at Fernhill. Are you free for a 15-minute call this week? Let me know a time that suits you.\n\nMeera' }],
};
export const APPS: Application[] = [
  { co: 'Brightwave', job: 'Frontend Engineer', status: 'INTERVIEW', todo: 'Choose an interview time', due: 'By Mon, Nov 3', applied: 'Oct 14', last: 'Mail from Priya Nair · Today', mail: 'brightwave' },
  { co: 'Kestrel Labs', job: 'React Developer', status: 'ASSESSMENT', todo: 'Finish the coding test', due: 'By Thu, Nov 6', applied: 'Oct 16', last: 'Mail from Kestrel Hiring · Yesterday', mail: 'kestrel' },
  { co: 'Lumen Health', job: 'Frontend Developer', status: 'RECRUITER_CONTACT', todo: '', applied: 'Oct 20', last: 'You replied · Oct 28', mail: 'lumen' },
  { co: 'Halcyon', job: 'UI Developer', status: 'APPLIED', todo: '', applied: 'Oct 29', last: 'Application received · Oct 29' },
  { co: 'Fernhill', job: 'Product Engineer', status: 'APPLIED', todo: '', applied: 'Oct 25', last: 'Application received · Oct 25' },
  { co: 'Orbitly', job: 'UI Engineer', status: 'REJECTED', todo: '', applied: 'Oct 9', last: 'Mail from Orbitly Careers · Oct 27', mail: 'orbitly' },
];

/** The example as it starts, and as the replay button puts it back. */
export function startState(view: View): State {
  return {
    view,
    mailId: null,
    reply: null,
    mails: structuredClone(MAILS),
    apps: structuredClone(APPS),
    syncing: false,
    synced: false,
    reading: false,
    syncedAt: '9:40 AM',
    needsOnly: false,
    newOnly: false,
  };
}

/** The mails that need the visitor: open steps the AI has read. */
export const needing = (s: State) => s.mails.filter((m) => m.state === 'OPEN' && !m.reading);

/** The Mails list after its quick filters. */
export const shownMails = (s: State) =>
  s.mails.filter((m) => (!s.needsOnly || (m.state === 'OPEN' && !m.reading)) && (!s.newOnly || m.isNew));
