import { Link } from '@tanstack/react-router';
import { CheckIcon, RotateCcwIcon } from 'lucide-react';
import type { Conversation } from '../../contracts/conversation';
import {
  careerContact,
  CATEGORY_LABEL,
  fakeOfferStep,
  mailCompany,
  parseSender,
  requestDetail,
  requestPastDue,
  requestTitle,
  scheduleLine,
  shortDue,
} from '../../lib/mails';
import { shortAgo } from '../../lib/shortAgo';
import { statusTag } from '../../lib/statusTags';
import { cn } from '../../lib/utils';
import { Avatar } from '../ui/avatar';
import { Ring } from '../ui/ring';
import { useSwipeRight } from '../ui/swipe';
import { FakeOfferTag } from './FakeOffer';
import { useRequestChange } from './useRequestChange';

/**
 * The third line (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #1): the company, what the mail
 * asks, and when it is due; red only once past due. With nothing asked: the date the mail names,
 * or "Nothing needed".
 */
type Part = { text: string; late?: boolean; done?: boolean };

/** The words of the third line, in order. */
function askParts(c: Conversation): Part[] {
  const asked = c.request;
  const where =
    mailCompany(c) ??
    (c.application ? null : (c.category && CATEGORY_LABEL[c.category]) || null) ??
    (careerContact(c) ? null : 'Not linked');
  const parts: Part[] = where ? [{ text: where }] : [];
  if (!asked) return [...parts, { text: scheduleLine(c) ?? 'Nothing needed' }];
  if (asked.state === 'OPEN') {
    const due = shortDue(asked);
    parts.push({ text: requestTitle(asked) });
    if (due) parts.push({ text: due, late: requestPastDue(asked) });
    return parts;
  }
  // Replied or done: what closed it ("You replied Nov 13"), else the step's words struck through.
  const detail = requestDetail(asked);
  return [...parts, detail ? { text: detail } : { text: requestTitle(asked), done: true }];
}

function AskLine({ conversation: c }: { conversation: Conversation }) {
  const parts = askParts(c);
  // The company and the due date stay whole; a long ask is cut short between them.
  const [first, ...rest] = parts;
  const last = rest.length > 1 ? rest[rest.length - 1] : null;
  const middle = last ? rest.slice(0, -1) : rest;
  const piece = (part: Part) => (
    <span
      className={cn(
        part.late && 'font-medium text-late',
        part.done && 'strike-done text-text-tertiary',
      )}
      data-done={part.done ? '' : undefined}
    >
      {part.text}
    </span>
  );
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[14.5px] leading-5 whitespace-nowrap text-text-secondary">
      {fakeOfferStep(c) && <FakeOfferTag />}
      <span className="flex min-w-0 flex-1">
        {first && <span className="max-w-[55%] shrink-0 truncate">{piece(first)}</span>}
        {middle.map((part, index) => (
          <span key={index} className="min-w-0 truncate">
            {'\u00a0· '}
            {piece(part)}
          </span>
        ))}
        {last && (
          <span className="shrink-0">
            {'\u00a0· '}
            {piece(last)}
          </span>
        )}
      </span>
    </span>
  );
}

/** The person's picture with the application's status as a small ring on its corner. */
function Photo({ conversation: c, name }: { conversation: Conversation; name: string }) {
  return (
    <span className="relative mt-0.5 flex size-10 shrink-0">
      <Avatar name={name} className="size-10 text-sm" />
      {c.application && (
        <span className="absolute -right-[3px] -bottom-[3px] flex rounded-full bg-background p-[1.5px]">
          <Ring kind={statusTag(c.application.effectiveStatus).ring} size={12} />
        </span>
      )}
    </span>
  );
}

/**
 * A job mail on a phone (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #1, Linear Inbox): the
 * person's picture with the status ring, then three lines: the person and how long ago, the
 * subject, and the company · ask · due date. A new mail has a blue dot before the name. Swiping it
 * to the right does its first action: Done for a step done outside mail, Reopen once closed.
 */
export function PhoneMailRow({ conversation: c }: { conversation: Conversation }) {
  const request = useRequestChange(c);
  const action = request.controls[0] ?? null;
  const swipe = useSwipeRight(action && !request.pending ? () => request.apply(action) : null);
  const sender = parseSender(c.sender).name;
  const subject = c.subject || '(No subject)';
  const done = action?.state === 'DONE';
  return (
    <div className="relative overflow-hidden">
      {action && (
        <div
          aria-hidden="true"
          className={cn(
            'absolute inset-0 flex items-center gap-1.5 pl-6 text-[15px] font-semibold text-white',
            done ? 'bg-ring-offer' : 'bg-text-tertiary',
          )}
        >
          {done ? <CheckIcon size={18} /> : <RotateCcwIcon size={18} />}
          {done ? 'Done' : action.label}
        </div>
      )}
      <Link
        to="/mails/$key"
        params={{ key: c.key }}
        aria-label={`${subject}, from ${sender}`}
        className="relative grid touch-pan-y grid-cols-[40px_minmax(0,1fr)] gap-x-3 bg-background px-[18px] py-[11px] text-text-primary transition-colors duration-450 select-none after:absolute after:right-0 after:bottom-0 after:left-0 after:h-[0.5px] after:bg-border-strong/55 active:bg-surface-selected active:duration-0"
        style={{
          translate: `${swipe.offset}px 0`,
          transition: swipe.dragging ? 'none' : 'translate 200ms cubic-bezier(0.2, 0, 0.38, 0.9)',
        }}
        {...swipe.handlers}
      >
        <Photo conversation={c} name={sender} />
        <span className="flex min-w-0 flex-col gap-px">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1.5 text-[15.5px] leading-[21px]',
                c.isNew ? 'font-semibold' : 'font-medium',
              )}
            >
              <span
                data-new-dot={c.isNew ? '' : undefined}
                aria-hidden="true"
                className={cn(
                  'size-2 shrink-0 rounded-full bg-accent transition-[scale,opacity,width,margin] duration-300 ease-standard',
                  c.isNew ? 'scale-100 opacity-100' : '-mr-1.5 w-0 scale-0 opacity-0 delay-200',
                )}
              />
              <span className="truncate">{sender}</span>
            </span>
            <span className="shrink-0 text-[13px] text-text-tertiary tabular-nums">
              {shortAgo(c.lastReceivedAt)}
            </span>
          </span>
          <span
            className={cn('truncate text-[14.5px] leading-5', !c.isNew && 'text-text-secondary')}
          >
            {subject}
          </span>
          <AskLine conversation={c} />
        </span>
      </Link>
    </div>
  );
}
