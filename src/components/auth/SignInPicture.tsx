import { ArrowRight, Dashboard, Document, Email } from '@carbon/icons-react';
import { Wordmark } from '../layout/Logo';
import { Avatar } from '../ui/avatar';
import { Tag } from '../ui/tag';
import type { TagColor } from '../../lib/statusTags';

/** Made-up mails, the same as on the approved mock (owner, 3 Nov 2026). */
const MAILS: {
  sender: string;
  subject: string;
  step: string;
  due?: { text: string; late?: boolean };
  meta: string;
  app?: { company: string; role: string; status: string; color: TagColor };
  date: string;
}[] = [
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

const NAV = [
  { label: 'Dashboard', Icon: Dashboard },
  { label: 'Mails', Icon: Email, open: true },
  { label: 'Applications', Icon: Document },
];

/**
 * A picture of the Mails list for the sign-in page's blue panel, drawn with the app's own parts so
 * it needs no image file. Only a picture: screen readers skip it and nothing in it can be used.
 */
export function SignInPicture() {
  return (
    <div
      aria-hidden="true"
      inert
      className="grid w-[980px] grid-cols-[200px_minmax(0,1fr)] overflow-hidden rounded-t-xl bg-background text-[13px] leading-[18px] text-text-primary shadow-[0_0_0_1px_rgb(255_255_255/0.25),0_24px_60px_rgb(0_0_0/0.28)] select-none"
    >
      <div className="flex flex-col gap-1 border-r border-border-subtle p-3">
        <Wordmark size={18} className="mb-4 px-2 pt-1" />
        {NAV.map(({ label, Icon, open }) => (
          <span
            key={label}
            className={\`flex h-8 items-center gap-2 rounded-md px-2 \${open ? 'bg-[var(--nav-active)] font-medium' : 'text-text-secondary'}\`}
          >
            <Icon size={14} className={open ? '' : 'text-text-tertiary'} />
            {label}
          </span>
        ))}
      </div>
      <div className="px-8 pt-7">
        <p className="text-[22px] leading-7 font-semibold tracking-[-0.025em]">Mails</p>
        <p className="mt-1 text-text-secondary">
          <span className="font-medium text-text-primary">4 mails need you</span>,{' '}
          <span className="text-danger-text">2 are past due</span>. Everything else is up to date.
        </p>
        <div className="mt-5 flex gap-6 border-b border-border-subtle">
          <span className="border-b-2 border-border-interactive pb-2 font-medium">Job mails 5</span>
          <span className="pb-2 text-text-secondary">Whole inbox</span>
          <span className="pb-2 text-text-secondary">Restricted</span>
        </div>
        {MAILS.map((mail) => (
          <div
            key={mail.subject}
            className="grid grid-cols-[28px_minmax(0,1fr)_190px_48px] gap-3 border-b border-border-subtle py-3"
          >
            <Avatar name={mail.sender} className="size-7 text-[11px]" />
            <div className="min-w-0">
              <p className="truncate font-medium">{mail.subject}</p>
              {mail.step ? (
                <p className="mt-0.5 flex items-center gap-1.5">
                  <ArrowRight size={14} className="shrink-0 text-link" />
                  <span className="truncate">{mail.step}</span>
                  {mail.due && (
                    <span
                      className={\`shrink-0 \${mail.due.late ? 'text-danger-text' : 'text-text-secondary'}\`}
                    >
                      · {mail.due.text}
                    </span>
                  )}
                </p>
              ) : (
                <p className="mt-0.5 text-text-tertiary">Nothing needed</p>
              )}
              <p className="mt-0.5 truncate text-[12px] text-text-tertiary">{mail.meta}</p>
            </div>
            {mail.app ? (
              <div className="min-w-0">
                <p className="truncate font-medium">{mail.app.company}</p>
                <p className="mt-1 flex items-center gap-2 text-text-secondary">
                  <Tag color={mail.app.color}>{mail.app.status}</Tag>
                  <span className="truncate">{mail.app.role}</span>
                </p>
              </div>
            ) : (
              <p className="text-text-tertiary">Not linked</p>
            )}
            <p className="text-right text-text-tertiary">{mail.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
