import { Link } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  ReplyIcon,
} from 'lucide-react';
import type { Conversation } from '../../contracts/conversation';
import {
  CATEGORY_LABEL,
  fakeOfferStep,
  mailDate,
  parseSender,
  requestDetail,
  requestPastDue,
  requestTitle,
  scheduleLine,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../ApplicationStatus';
import { useSwipeRight } from '../ui/swipe';
import { FakeOfferTag } from './FakeOffer';
import { useRequestChange } from './useRequestChange';

/** The mark before a step: an arrow while open, a reply mark once replied, a tick when done. */
const STEP_MARK = {
  OPEN: { Icon: ArrowRightIcon, color: 'text-link' },
  REPLIED: { Icon: ReplyIcon, color: 'text-text-secondary' },
  DONE: { Icon: CircleCheckIcon, color: 'text-text-tertiary' },
} as const;

/** The third line: the next step in one line, or what the mail names when it asks nothing. */
function StepLine({ conversation: c }: { conversation: Conversation }) {
  const asked = c.request;
  const { Icon, color } = asked ? STEP_MARK[asked.state] : { Icon: CheckIcon, color: '' };
  const words = asked ? requestTitle(asked) : (scheduleLine(c) ?? 'Nothing needed');
  return (
    <span className="flex items-center gap-1.5 text-[15px] leading-5 text-text-secondary">
      <Icon size={15} aria-hidden="true" className={cn('shrink-0', color)} />
      <span
        className={cn(
          'min-w-0 truncate',
          asked?.state === 'DONE' && 'text-text-tertiary line-through',
        )}
      >
        {words}
      </span>
    </span>
  );
}

/** The fourth line: the application's status and company (or the mail's type), and the step's state. */
function TagLine({ conversation: c }: { conversation: Conversation }) {
  const asked = c.request;
  const where = c.application
    ? c.application.companyName
    : [c.category && CATEGORY_LABEL[c.category], 'Not linked'].filter(Boolean).join(' · ');
  const state = asked && requestDetail(asked);
  const late = asked && requestPastDue(asked);
  return (
    <span className="mt-0.5 flex min-h-[22px] items-center gap-1.5 text-[13px] whitespace-nowrap text-text-tertiary">
      {c.application && <StatusBadge status={c.application.effectiveStatus} />}
      {fakeOfferStep(c) && <FakeOfferTag />}
      <span className="min-w-0 truncate">
        {where}
        {state && (
          <>
            {' · '}
            <span className={cn(late && 'text-danger-text')}>{state}</span>
          </>
        )}
      </span>
    </span>
  );
}

/**
 * A job mail on a phone (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): four short lines and
 * no picture (who and when, the subject, the next step, the status and company), so about six
 * mails fit on a screen. A new mail has a blue dot in the margin, as phone mail apps show it.
 * Swiping it to the right does its first action, such as "I did this" on a request done outside
 * mail.
 */
export function PhoneMailRow({ conversation: c }: { conversation: Conversation }) {
  const request = useRequestChange(c);
  const action = request.controls[0] ?? null;
  const swipe = useSwipeRight(action && !request.pending ? () => request.apply(action) : null);
  const sender = parseSender(c.sender).name;
  const subject = c.subject || '(No subject)';
  return (
    <div className="relative overflow-hidden">
      {action && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center gap-2 bg-tag-green-bg pl-6 font-semibold text-tag-green"
        >
          <CheckIcon size={20} />
          {action.label}
        </div>
      )}
      <Link
        to="/mails/$key"
        params={{ key: c.key }}
        aria-label={`${subject}, from ${sender}`}
        className="relative flex touch-pan-y bg-background pt-2.5 pr-5 pb-[11px] pl-8 text-text-primary transition-colors duration-450 select-none after:absolute after:right-0 after:bottom-0 after:left-8 after:h-[0.5px] after:bg-border-strong/55 active:bg-surface-selected active:duration-0"
        style={{
          translate: `${swipe.offset}px 0`,
          transition: swipe.dragging ? 'none' : 'translate 200ms cubic-bezier(0.2, 0, 0.38, 0.9)',
        }}
        {...swipe.handlers}
      >
        {/* The new-mail dot sits in its own lane left of the text, never in the side margin. */}
        {c.isNew && (
          <span
            data-new-dot=""
            aria-hidden="true"
            className="absolute top-4 left-[11px] size-2.5 rounded-full bg-link"
          />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[17px] leading-[22px] font-semibold">
              {sender}
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[15px] text-text-tertiary tabular-nums">
              {mailDate(c.lastReceivedAt)}
              <ChevronRightIcon size={15} aria-hidden="true" />
            </span>
          </span>
          <span className="truncate text-[15px] leading-5">{subject}</span>
          <StepLine conversation={c} />
          <TagLine conversation={c} />
        </span>
      </Link>
    </div>
  );
}
