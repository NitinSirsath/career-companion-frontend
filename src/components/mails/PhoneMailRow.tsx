import { Link } from '@tanstack/react-router';
import { Checkmark } from '@carbon/icons-react';
import type { Conversation } from '../../contracts/conversation';
import { CATEGORY_LABEL, mailDate, parseSender } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../ApplicationStatus';
import { Avatar } from '../ui/avatar';
import { useSwipeRight } from '../ui/swipe';
import { StepLine } from './MailRow';
import { useRequestChange } from './useRequestChange';

/**
 * A job mail on a phone (owner, 3 Nov 2026): who wrote and when, the subject in grey, the next
 * step with its due date on its own line, then the application, in one tappable row. Swiping it to the right does its first action, such as "I did this" on a request
 * done outside mail.
 */
export function PhoneMailRow({ conversation: c }: { conversation: Conversation }) {
  const request = useRequestChange(c);
  const action = request.controls[0] ?? null;
  const swipe = useSwipeRight(action && !request.pending ? () => request.apply(action) : null);
  const sender = parseSender(c.sender).name;
  return (
    // Edge to edge, as phone mail apps draw their rows.
    <div className="relative overflow-hidden border-b border-border-subtle">
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
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[15px]',
                c.isNew ? 'font-semibold' : 'font-medium',
              )}
            >
              {sender}
            </span>
            {c.isNew && <span className="size-2 shrink-0 self-center rounded-full bg-link" />}
            <span className="shrink-0 text-xs text-text-tertiary tabular-nums">
              {mailDate(c.lastReceivedAt)}
            </span>
          </div>
          <span className="truncate text-text-secondary">{c.subject || '(No subject)'}</span>
          <div className="mt-1 text-[15px] leading-[22px]">
            <StepLine conversation={c} dueApart />
          </div>
          <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-text-secondary">
            {c.application ? (
              <>
                <StatusBadge status={c.application.effectiveStatus} />
                <span className="truncate">
                  {[c.application.companyName, c.application.jobTitle].filter(Boolean).join(' · ')}
                </span>
              </>
            ) : (
              <span className="truncate">
                {[c.category && CATEGORY_LABEL[c.category], 'Not linked']
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
