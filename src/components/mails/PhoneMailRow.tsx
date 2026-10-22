import { Link } from '@tanstack/react-router';
import { Checkmark } from '@carbon/icons-react';
import type { Conversation } from '../../contracts/conversation';
import { mailDate, parseSender } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../ApplicationStatus';
import { Avatar } from '../ui/avatar';
import { useSwipeRight } from '../ui/swipe';
import { ConversationAction } from './ConversationAction';
import { MailType } from './MailType';
import { useRequestChange } from './useRequestChange';

/**
 * A job mail on a phone: who wrote, when, the subject, what it needs and its application, in one
 * tappable row. Swiping it to the right does its first action, such as "Mark done".
 */
export function PhoneMailRow({ conversation: c }: { conversation: Conversation }) {
  const request = useRequestChange(c);
  const action = request.controls[0] ?? null;
  const swipe = useSwipeRight(action && !request.pending ? () => request.apply(action) : null);
  const sender = parseSender(c.sender).name;
  return (
    // Edge to edge, as phone mail apps draw their rows.
    <div className="relative -mx-4 overflow-hidden border-b border-border-subtle">
      {action && (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center gap-2 bg-tag-green-bg pl-6 font-semibold text-tag-green"
        >
          <Checkmark size={20} />
          {action.label}
        </div>
      )}
      <Link
        to="/mails/$key"
        params={{ key: c.key }}
        aria-label={`${c.subject || '(No subject)'}, from ${sender}`}
        className="relative flex touch-pan-y items-start gap-3 bg-background px-4 py-3 text-text-primary select-none active:bg-layer-hover"
        style={{
          translate: `${swipe.offset}px 0`,
          transition: swipe.dragging ? 'none' : 'translate 200ms cubic-bezier(0.2, 0, 0.38, 0.9)',
        }}
        {...swipe.handlers}
      >
        <Avatar name={sender} className="size-10 text-sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className={cn('min-w-0 flex-1 truncate', c.isNew && 'font-semibold')}>
              {sender}
            </span>
            {c.isNew && <span className="size-2 shrink-0 self-center rounded-full bg-link" />}
            <span className="shrink-0 text-xs text-text-tertiary">
              {mailDate(c.lastReceivedAt)}
            </span>
          </div>
          <span className={cn('truncate', c.isNew && 'font-semibold')}>
            {c.subject || '(No subject)'}
          </span>
          <div className="mt-1 flex flex-col gap-2">
            <ConversationAction conversation={c} controls={false} />
            <div className="flex flex-wrap items-center gap-1.5">
              {c.application ? (
                <StatusBadge status={c.application.effectiveStatus} />
              ) : (
                c.category && <MailType category={c.category} />
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
