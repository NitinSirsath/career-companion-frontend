import { Link } from '@tanstack/react-router';
import { ArrowRight, Checkmark, Reply } from '@carbon/icons-react';
import { useSandboxMailbox } from '../../api/appMode';
import type { Conversation } from '../../contracts/conversation';
import {
  CATEGORY_LABEL,
  fakeOfferStep,
  mailCounts,
  mailDate,
  parseSender,
  requestDetail,
  requestPastDue,
  requestTitle,
  scheduleLine,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
import { getGmailConversationUrl } from '../../utils/gmail';
import { Avatar } from '../ui/avatar';
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

/** The mark before a step: an arrow while it is open, a reply mark once replied, a check when done. */
const STEP_MARK = {
  OPEN: { Icon: ArrowRight, color: 'text-link' },
  REPLIED: { Icon: Reply, color: 'text-text-secondary' },
  DONE: { Icon: Checkmark, color: 'text-ok' },
} as const;

/** A mail that asks for nothing: its interview or test date, else "Nothing needed". */
function NoStep({ conversation }: { conversation: Conversation }) {
  const schedule = scheduleLine(conversation);
  return (
    <p className={cn('mt-0.5', schedule ? 'font-medium' : 'text-text-tertiary')}>
      {schedule ?? 'Nothing needed'}
    </p>
  );
}

/**
 * The next step with a blue arrow and its due date (red when late); a replied step with a reply
 * mark, a done one with a green check; else an interview or test date, or "Nothing needed".
 * `dueApart`: the due date on its own line (phones).
 */
export function StepLine({
  conversation: c,
  dueApart = false,
}: {
  conversation: Conversation;
  dueApart?: boolean;
}) {
  const asked = c.request;
  if (!asked) return <NoStep conversation={c} />;
  const detail = requestDetail(asked);
  const { Icon, color } = STEP_MARK[asked.state];
  const due = detail && (
    <span className={requestPastDue(asked) ? 'text-danger-text' : 'text-text-secondary'}>
      {detail}
    </span>
  );
  return (
    <>
      <p className="mt-0.5 flex gap-2">
        <Icon size={16} aria-hidden="true" className={cn('mt-0.5 shrink-0', color)} />
        <span className={cn('min-w-0', asked.state !== 'OPEN' && 'text-text-secondary')}>
          <span className="max-md:line-clamp-2">{requestTitle(asked)}</span>
          {due && !dueApart && <> · {due}</>}
          {fakeOfferStep(c) && (
            <span className="ml-2 inline-flex align-middle">
              <FakeOfferTag />
            </span>
          )}
        </span>
      </p>
      {due && dueApart && <p className="mt-0.5 ml-6 text-xs">{due}</p>}
    </>
  );
}

/** "Riya Kapoor · Lumen Apps · Recruiter · 5 mails, 2 from you": who, where, what, how many. */
export function MetaLine({ conversation: c }: { conversation: Conversation }) {
  const parts = [
    parseSender(c.sender).name,
    c.company,
    c.category && CATEGORY_LABEL[c.category],
    mailCounts(c.mailCount + c.sentCount, c.sentCount),
  ];
  return (
    <p className="mt-1 truncate text-xs text-text-tertiary">{parts.filter(Boolean).join(' · ')}</p>
  );
}

/**
 * One job mail on a laptop (owner, 3 Nov 2026): coloured initials; the subject, the next step and
 * a grey line of who, where and how many; the application; the date; the "…" menu when pointed
 * at. The whole row opens the mail.
 */
export function MailRow({ conversation: c }: { conversation: Conversation }) {
  const sender = parseSender(c.sender).name;
  return (
    <li className="group relative grid grid-cols-[32px_minmax(0,1fr)_minmax(180px,240px)_64px_32px] gap-4 border-b border-border-subtle px-3 py-3.5 transition-colors duration-70 ease-standard hover:bg-layer-hover">
      {c.isNew && (
        <span className="absolute top-[26px] left-0.5 size-1.5 rounded-full bg-link">
          <span className="sr-only">New</span>
        </span>
      )}
      <Avatar name={sender} className="mt-px" />
      <div className="min-w-0">
        <Link
          to="/mails/$key"
          params={{ key: c.key }}
          className={cn(
            'block truncate font-medium text-text-primary outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-border-focus',
            c.isNew && 'font-semibold',
          )}
        >
          {c.subject || '(No subject)'}
        </Link>
        <StepLine conversation={c} />
        <MetaLine conversation={c} />
      </div>
      <div className={cn('min-w-0 text-[13px]', ABOVE_LINK)}>
        <ConversationApplication conversation={c} appearance="row" />
      </div>
      <p className="text-right text-xs leading-5 text-text-tertiary tabular-nums">
        {mailDate(c.lastReceivedAt)}
      </p>
      <div
        className={cn(
          '-mt-1.5 opacity-0 transition-opacity duration-70 group-focus-within:opacity-100 group-hover:opacity-100 has-[[aria-expanded=true]]:opacity-100',
          ABOVE_LINK,
        )}
      >
        <RowMenu conversation={c} />
      </div>
    </li>
  );
}
