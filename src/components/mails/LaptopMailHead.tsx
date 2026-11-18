import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  BriefcaseBusinessIcon,
  Building2Icon,
  ExternalLinkIcon,
  MailIcon,
  type LucideIcon,
} from 'lucide-react';
import { useSandboxMailbox } from '../../api/appMode';
import { useMailThread } from '../../api/mailbox';
import type { Conversation } from '../../contracts/conversation';
import { mailCounts, mailDate, parseSender } from '../../lib/mails';
import { statusTag } from '../../lib/statusTags';
import { getGmailConversationUrl } from '../../utils/gmail';
import { Ring, StatusBadge } from '../ui/ring';
import { Avatar } from '../ui/avatar';
import { FakeOfferTag } from './FakeOffer';
import { MailType } from './MailType';

/**
 * The top of a job mail on a laptop (laptop v2, owner 18 Nov 2026, `PHONE-LINEAR-mock/desktop.html`):
 * a grey "who · when" line above the title, a "For ◔ company" link under it, then the facts as
 * pills in one round card, as on the phone.
 */

/** "Riya Kapoor · Oct 22": who wrote last and when, above the title. */
export function MailKicker({ conversation }: { conversation: Conversation }) {
  const who = parseSender(conversation.sender).name;
  return (
    <span className="block text-sm text-text-secondary">
      {who} · {mailDate(conversation.lastReceivedAt)}
    </span>
  );
}

/** "For ◔ Lumen Apps · Frontend Developer": the application this mail belongs to. */
function ForLink({ conversation }: { conversation: Conversation }) {
  const { application } = conversation;
  if (!application) return null;
  return (
    <p className="flex min-w-0 items-center gap-2 text-sm">
      <span className="text-text-secondary">For</span>
      <Ring kind={statusTag(application.effectiveStatus).ring} size={14} />
      <Link
        to="/applications/$id"
        params={{ id: application.id }}
        className="min-w-0 truncate text-text-primary hover:underline"
      >
        {[application.companyName, application.jobTitle].filter(Boolean).join(' · ')}
      </Link>
    </p>
  );
}

const PILL =
  'inline-flex h-[27px] max-w-full min-w-0 items-center gap-1.5 rounded-full bg-layer-hover px-2.5 text-[13px] font-medium whitespace-nowrap text-text-primary';

function Pill({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className={PILL}>
      {Icon && <Icon size={14} aria-hidden="true" className="shrink-0 text-text-secondary" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

/** "3 mails · 1 from you", counted in the conversation as Gmail has it now. */
function LiveMailCount({ threadId }: { threadId: string }) {
  const { data } = useMailThread(threadId);
  if (!data) return null;
  const fromYou = data.messages.filter((message) => message.sentByUser).length;
  return <Pill icon={MailIcon}>{mailCounts(data.messages.length, fromYou)}</Pill>;
}

/** Where the conversation lives: Gmail in prod, the mail sandbox in dev mode. */
function MailboxPill({ threadId, subject }: { threadId: string; subject: string }) {
  const sandbox = useSandboxMailbox();
  const body = (
    <>
      <ExternalLinkIcon size={14} aria-hidden="true" className="shrink-0 text-text-secondary" />
      {sandbox ? 'Open in sandbox' : 'Open in Gmail'}
    </>
  );
  const look = `${PILL} transition-colors duration-70 ease-standard hover:bg-surface-selected`;
  if (sandbox)
    return (
      <Link to="/sandbox/$threadId" params={{ threadId }} className={look}>
        {body}
      </Link>
    );
  return (
    <a
      href={getGmailConversationUrl(threadId)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open email "${subject}" in Gmail`}
      className={look}
    >
      {body}
    </a>
  );
}

/**
 * The facts in one round card: the status (or the kind of mail), the person, the company, the role
 * when no application names it, Probably fake, how many mails, New, and the way to the mailbox.
 */
function MailPills({ conversation: c }: { conversation: Conversation }) {
  const sender = parseSender(c.sender).name;
  const subject = c.subject || '(No subject)';
  return (
    <div className="flex flex-wrap gap-1.5 rounded-[14px] bg-surface-subtle p-[7px]">
      <span className={PILL}>
        {c.application ? (
          <StatusBadge status={c.application.effectiveStatus} />
        ) : (
          c.category && <MailType category={c.category} />
        )}
      </span>
      {sender && (
        <span className={PILL}>
          <Avatar name={sender} className="size-[17px] text-[8px]" />
          <span className="min-w-0 truncate">{sender}</span>
        </span>
      )}
      {c.company && <Pill icon={Building2Icon}>{c.company}</Pill>}
      {c.role && !c.application?.jobTitle && <Pill icon={BriefcaseBusinessIcon}>{c.role}</Pill>}
      {c.fakeOfferWarning && <FakeOfferTag />}
      {c.threadId ? (
        <LiveMailCount threadId={c.threadId} />
      ) : (
        <Pill icon={MailIcon}>{mailCounts(c.mailCount, c.sentCount)}</Pill>
      )}
      {c.isNew && (
        <span className={PILL}>
          <span aria-hidden="true" className="size-[7px] rounded-full bg-link" />
          New
        </span>
      )}
      {c.threadId && <MailboxPill threadId={c.threadId} subject={subject} />}
    </div>
  );
}

/** Under the title: the "For" link, then the pills card. */
export function LaptopMailFacts({ conversation }: { conversation: Conversation }) {
  return (
    <div className="mt-1 flex flex-col items-start gap-3">
      <ForLink conversation={conversation} />
      <MailPills conversation={conversation} />
    </div>
  );
}
