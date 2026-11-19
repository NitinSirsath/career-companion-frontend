import { Link } from '@tanstack/react-router';
import { useSandboxMailbox } from '../../api/appMode';
import type { Conversation } from '../../contracts/conversation';
import {
  fakeOfferStep,
  mailDate,
  parseSender,
  requestDetail,
  requestPastDue,
  requestTitle,
  scheduleLine,
} from '../../lib/mails';
import { statusTag } from '../../lib/statusTags';
import { cn } from '../../lib/utils';
import { getGmailConversationUrl } from '../../utils/gmail';
import { Avatar } from '../ui/avatar';
import { Ring } from '../ui/ring';
import { OverflowMenu, type MenuAction } from '../ui/menu';
import { ConversationApplication } from './ConversationApplication';
import { FakeOfferTag } from './FakeOffer';
import { useRequestChange } from './useRequestChange';

/** Interactive parts of a row sit above its stretched link, so they stay clickable. */
const ABOVE_LINK = 'relative z-10';

/** The row's "…" menu: change what the mail needs, and open it in Gmail. */
export function RowMenu({ conversation }: { conversation: Conversation }) {
  const request = useRequestChange(conversation);
  const sandbox = useSandboxMailbox();
  const actions: MenuAction[] = request.controls.map((control) => ({
    label: control.label,
    disabled: request.pending,
    onSelect: () => request.apply(control),
  }));
  if (conversation.threadId && !sandbox) {
    const url = getGmailConversationUrl(conversation.threadId);
    actions.push({
      label: 'Open in Gmail',
      onSelect: () => window.open(url, '_blank', 'noopener'),
    });
  }
  if (actions.length === 0) return null;
  return (
    <OverflowMenu label={`Actions for ${conversation.subject || 'this mail'}`} actions={actions} />
  );
}

/** The mark before a step, in the row's grey: an arrow while open, a reply mark, a check when done. */
const STEP_MARK = { OPEN: '→', REPLIED: '↩', DONE: '✓' } as const;

/**
 * The row's one grey line (laptop v2, owner 18 Nov 2026): "→ Pick a time · Due Mon" while open,
 * "↩ You replied Nov 13" once replied, else an interview or test date, or "Nothing needed". Red
 * only when past due.
 */
export function StepLine({ conversation: c }: { conversation: Conversation }) {
  const asked = c.request;
  if (!asked)
    return (
      <p className="mt-0.5 truncate text-text-secondary">{scheduleLine(c) ?? 'Nothing needed'}</p>
    );
  const detail = requestDetail(asked);
  const due = detail && (
    <span className={cn(requestPastDue(asked) && 'text-danger-text')}>{detail}</span>
  );
  // Replied: the reply says it all ("You replied Nov 13"); else the step, then its due date.
  const words = asked.state === 'REPLIED' && due ? due : requestTitle(asked);
  return (
    <p className="mt-0.5 flex min-w-0 items-center gap-2 text-text-secondary">
      <span className="min-w-0 truncate">
        <span aria-hidden="true">{STEP_MARK[asked.state]} </span>
        {words}
        {due && asked.state !== 'REPLIED' && <> · {due}</>}
      </span>
      {fakeOfferStep(c) && <FakeOfferTag />}
    </p>
  );
}

/**
 * One job mail on a laptop (laptop v2, owner 18 Nov 2026, `PHONE-LINEAR-mock/desktop.html`): the
 * photo with the status ring on it; the person, then the subject on the same line; one grey line
 * for the ask and its due date; the company with the status ring and word; the date; the "…" menu
 * when pointed at. A blue dot marks a new mail. The whole row opens the mail.
 */
export function MailRow({ conversation: c }: { conversation: Conversation }) {
  const sender = parseSender(c.sender).name;
  return (
    <div className="group relative grid grid-cols-[30px_minmax(0,1fr)_210px_64px_32px] items-center gap-3.5 border-b border-border-subtle px-2.5 py-2.5 transition-colors duration-70 ease-standard hover:bg-layer-hover">
      <span className="relative size-[30px] shrink-0">
        <Avatar name={sender} className="size-[30px] text-[11px]" />
        {c.application && (
          // The application's status as a small ring on the photo, as on the phone.
          <span className="absolute -right-[3px] -bottom-[3px] flex rounded-full bg-background p-[1.5px]">
            <Ring kind={statusTag(c.application.effectiveStatus).ring} size={12} />
          </span>
        )}
      </span>
      <div className="min-w-0">
        <p className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
          <span
            className={cn(
              'size-[7px] shrink-0 -translate-y-px self-center rounded-full bg-link transition-[scale,opacity,margin] duration-300 ease-standard',
              c.isNew ? 'scale-100 opacity-100' : '-mr-2 w-0 scale-0 opacity-0 delay-200',
            )}
          >
            {c.isNew && <span className="sr-only">New</span>}
          </span>
          <span className={cn('shrink-0', c.isNew ? 'font-semibold' : 'font-medium')}>
            {sender}
          </span>
          <Link
            to="/mails/$key"
            params={{ key: c.key }}
            className={cn(
              'min-w-0 truncate outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-border-focus',
              c.isNew ? 'text-text-primary' : 'text-text-secondary',
            )}
          >
            {c.subject || '(No subject)'}
          </Link>
        </p>
        <StepLine conversation={c} />
      </div>
      <div className={cn('min-w-0 text-[13px]', ABOVE_LINK)}>
        <ConversationApplication conversation={c} appearance="row" />
      </div>
      <p className="self-start pt-0.5 text-right text-xs leading-5 text-text-tertiary tabular-nums">
        {mailDate(c.lastReceivedAt)}
      </p>
      <div
        className={cn(
          'opacity-0 transition-opacity duration-70 group-focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100',
          ABOVE_LINK,
        )}
      >
        <RowMenu conversation={c} />
      </div>
    </div>
  );
}
