import { ArrowRight, Dashboard, Document, Email } from '@carbon/icons-react';
import { pictureAt, type PictureMail, type PictureRow } from '../../lib/signInPicture';
import { cn } from '../../lib/utils';
import { Wordmark } from '../layout/Logo';
import { Avatar } from '../ui/avatar';
import { Tag } from '../ui/tag';

const NAV = [
  { label: 'Dashboard', Icon: Dashboard },
  { label: 'Mails', Icon: Email, open: true },
  { label: 'Applications', Icon: Document },
];

/** A count that changes: the new number rises in, after the first step. */
function Count({ value, moved }: { value: number; moved: boolean }) {
  return (
    <span key={value} className={cn('inline-block', moved && 'animate-count-in')}>
      {value}
    </span>
  );
}

/** The next step with its arrow, "Nothing needed", or the AI's grey shimmer while it reads. */
function Step({
  mail,
  reading,
  withDue,
  fadeIn,
}: {
  mail: PictureMail;
  reading: boolean;
  withDue: boolean;
  fadeIn: boolean;
}) {
  if (reading)
    return (
      <p className="mt-0.5">
        <span className="ai-shimmer">Reading the mail</span>
      </p>
    );
  if (!mail.step)
    return (
      <p className={cn('mt-0.5 text-text-tertiary', fadeIn && 'animate-fade-in')}>Nothing needed</p>
    );
  return (
    <p className={cn('mt-0.5 flex items-center gap-1.5', fadeIn && 'animate-fade-in')}>
      <ArrowRight size={14} className="shrink-0 text-link" />
      <span className="truncate">{mail.step}</span>
      {withDue && mail.due && (
        <span
          className={cn('shrink-0', mail.due.late ? 'text-danger-text' : 'text-text-secondary')}
        >
          · {mail.due.text}
        </span>
      )}
    </p>
  );
}

/** The application column: empty while the AI reads the mail, then the application or "Not linked". */
function Application({
  mail,
  reading,
  fadeIn,
}: {
  mail: PictureMail;
  reading: boolean;
  fadeIn: boolean;
}) {
  if (reading) return <span />;
  if (!mail.app) return <p className="text-text-tertiary">Not linked</p>;
  return (
    <div className={cn('min-w-0', fadeIn && 'animate-fade-in')}>
      <p className="truncate font-medium">{mail.app.company}</p>
      <p className="mt-1 flex items-center gap-2 text-text-secondary">
        <Tag color={mail.app.color}>{mail.app.status}</Tag>
        <span className="truncate">{mail.app.role}</span>
      </p>
    </div>
  );
}

/**
 * One mail. A mail that came in after the page opened grows in on a pale tint, which fades once the
 * AI has read it.
 */
function Row({ row, compact }: { row: PictureRow; compact: boolean }) {
  const { mail, reading } = row;
  return (
    <div className={cn('grid', row.arrived && 'animate-mail-in')}>
      <div
        className={cn(
          '-mx-2 grid min-h-0 overflow-hidden border-b border-border-subtle px-2 transition-colors duration-[1600ms] ease-standard',
          compact
            ? 'grid-cols-[24px_minmax(0,1fr)] gap-2.5 py-2.5'
            : 'grid-cols-[28px_minmax(0,1fr)_190px_48px] gap-3 py-3',
          reading && 'bg-tint',
        )}
      >
        <Avatar
          name={mail.sender}
          className={compact ? 'size-6 text-[10px]' : 'size-7 text-[11px]'}
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{mail.subject}</p>
          <Step mail={mail} reading={reading} withDue={!compact} fadeIn={row.arrived} />
          {!compact && (
            <p className="mt-0.5 truncate text-[12px] text-text-tertiary">
              {reading ? mail.readingMeta : mail.meta}
            </p>
          )}
        </div>
        {!compact && (
          <>
            <Application mail={mail} reading={reading} fadeIn={row.arrived} />
            <p className="text-right text-text-tertiary">{mail.date}</p>
          </>
        )}
      </div>
    </div>
  );
}

/** "4 mails need you, 2 are past due." */
function NeedYou({ value, moved }: { value: number; moved: boolean }) {
  return (
    <>
      <span className="font-medium text-text-primary">
        <Count value={value} moved={moved} /> mails need you
      </span>
      , <span className="text-danger-text">2 are past due</span>.
    </>
  );
}

/**
 * A picture of the Mails list for the sign-in page, drawn with the app's own parts so it needs no
 * image file. Only a picture: screen readers skip it and nothing in it can be used. `step` comes
 * from `usePictureStep`: two made-up mails come in and are read, then it stays still. `compact`:
 * the small card on phones and tablets, with subject and next step only.
 */
export function SignInPicture({ step, compact = false }: { step: number; compact?: boolean }) {
  const { rows, needYou, jobMails } = pictureAt(step);
  const moved = step > 0;
  const list = rows.map((row) => <Row key={row.mail.subject} row={row} compact={compact} />);

  if (compact)
    return (
      <div
        aria-hidden="true"
        inert
        className="h-[260px] overflow-hidden rounded-xl bg-background px-4 pt-3.5 text-[12px] leading-4 text-text-primary shadow-[0_0_0_1px_rgb(255_255_255/0.25),0_16px_40px_rgb(0_0_0/0.25)] select-none"
      >
        <p className="text-[15px] leading-5 font-semibold tracking-[-0.02em]">Mails</p>
        <p className="mt-0.5 mb-1.5 text-text-secondary">
          <NeedYou value={needYou} moved={moved} />
        </p>
        {list}
      </div>
    );

  return (
    <div
      aria-hidden="true"
      inert
      className="grid min-h-[calc(100%+24px)] w-[980px] grid-cols-[200px_minmax(0,1fr)] overflow-hidden rounded-xl bg-background text-[13px] leading-[18px] text-text-primary shadow-[0_0_0_1px_rgb(255_255_255/0.25),0_24px_60px_rgb(0_0_0/0.28)] select-none"
    >
      <div className="flex flex-col gap-1 border-r border-border-subtle p-3">
        <Wordmark size={18} className="mb-4 px-2 pt-1" />
        {NAV.map(({ label, Icon, open }) => (
          <span
            key={label}
            className={`flex h-8 items-center gap-2 rounded-md px-2 ${open ? 'bg-[var(--nav-active)] font-medium' : 'text-text-secondary'}`}
          >
            <Icon size={14} className={open ? '' : 'text-text-tertiary'} />
            {label}
          </span>
        ))}
      </div>
      <div className="min-w-0 px-8 pt-7">
        <p className="text-[22px] leading-7 font-semibold tracking-[-0.025em]">Mails</p>
        <p className="mt-1 text-text-secondary">
          <NeedYou value={needYou} moved={moved} /> Everything else is up to date.
        </p>
        <div className="mt-5 flex gap-6 border-b border-border-subtle">
          <span className="border-b-2 border-border-interactive pb-2 font-medium">
            Job mails <Count value={jobMails} moved={moved} />
          </span>
          <span className="pb-2 text-text-secondary">Whole inbox</span>
          <span className="pb-2 text-text-secondary">Restricted</span>
        </div>
        {list}
      </div>
    </div>
  );
}
