import { StatusBadge } from '../ApplicationStatus';
import { FakeOfferTag } from '../mails/FakeOffer';
import { MailType } from '../mails/MailType';
import { TodoState } from '../mails/TodoState';
import { cn } from '../../lib/utils';
import { PREVIEW_MAILS, type PreviewMail } from './previewMails';

/**
 * The columns of the Mails page. Phones show each mail as stacked lines, mid-size screens leave
 * out the type and date, and wide screens show all six.
 */
const GRID =
  'grid grid-cols-1 gap-x-6 gap-y-2 px-4 md:grid-cols-[8px_minmax(0,1.6fr)_minmax(0,1.2fr)_minmax(0,1fr)] md:gap-y-0 md:px-5 lg:grid-cols-[8px_minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.7fr)]';
const CELL = 'flex min-w-0 flex-col items-start gap-1.5';

function Row({ mail }: { mail: PreviewMail }) {
  return (
    <div className={cn(GRID, 'border-t border-border-subtle py-3.5')}>
      <span className={cn('mt-1.5 hidden size-2 rounded-full md:block', mail.isNew && 'bg-link')} />
      <div className={CELL}>
        <span className={cn(mail.isNew && 'font-semibold')}>{mail.subject}</span>
        <span className="text-xs text-text-secondary">{mail.summary}</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary md:hidden">
          <MailType category={mail.category} />
          <span>· {mail.date}</span>
        </span>
      </div>
      <div className={cn(CELL, 'hidden lg:flex')}>
        <MailType category={mail.category} />
        {mail.fakeOffer && <FakeOfferTag />}
      </div>
      <div className={CELL}>
        <span className={cn(mail.state === 'DONE' && 'text-text-secondary')}>{mail.step}</span>
        {mail.due && <span className="text-xs text-text-secondary">{mail.due}</span>}
        <TodoState state={mail.state} fakeOffer={mail.fakeOffer} />
      </div>
      <div className={cn(CELL, 'flex-row flex-wrap items-center gap-2 md:flex-col md:items-start')}>
        {mail.application ? (
          <>
            <StatusBadge status={mail.application.status} />
            <span className="text-xs text-text-secondary">{mail.application.job}</span>
          </>
        ) : (
          <span className="text-xs text-text-secondary">Not linked</span>
        )}
      </div>
      <span className="hidden text-xs lg:block">{mail.date}</span>
    </div>
  );
}

/** A drawn example of the Mails page with made-up mails: what NorthList shows, at a glance. */
export function MailsPreview() {
  return (
    <figure className="m-0 mt-10 md:mt-14">
      <div
        role="img"
        aria-label="An example of the Mails page: each job mail with its type, next step and application"
        className="-mx-4 border-y border-border-subtle bg-background md:mx-0 md:border-x"
      >
        <div className="flex items-baseline justify-between gap-4 px-4 py-3 md:px-5 md:py-4">
          <span className="text-xl leading-7">Mails</span>
          <span className="text-xs text-text-secondary">Checked Gmail at 9:40 AM</span>
        </div>
        <div
          className={cn(
            GRID,
            'hidden h-10 items-center border-t border-border-subtle bg-surface-subtle font-semibold md:grid',
          )}
        >
          <span />
          <span>Mail</span>
          <span className="hidden lg:block">Type</span>
          <span>Next step</span>
          <span>Application</span>
          <span className="hidden lg:block">Last mail</span>
        </div>
        {PREVIEW_MAILS.map((mail) => (
          <Row key={mail.subject} mail={mail} />
        ))}
      </div>
      <figcaption className="mt-3 text-xs text-text-secondary">
        An example with made-up mails.
      </figcaption>
    </figure>
  );
}
