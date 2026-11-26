import type { ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import {
  Building2Icon,
  ClockIcon,
  ExternalLinkIcon,
  ReplyIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useSandboxMailbox } from '../../api/appMode';
import { useMailThread } from '../../api/mailbox';
import type { ConversationDetail } from '../../contracts/conversation';
import { useKeptReply } from '../../lib/keptReply';
import { NO_REPLY_SHORT } from '../../lib/mailReply';
import {
  CATEGORY_LABEL,
  FAKE_OFFER,
  mailCompany,
  parseSender,
  requestPastDue,
  shortDue,
} from '../../lib/mails';
import { docWords } from '../../lib/replyDoc';
import { statusTag } from '../../lib/statusTags';
import { cn } from '../../lib/utils';
import { getGmailConversationUrl } from '../../utils/gmail';
import { BarCircle, BarField, PhoneBottomBar } from '../phone/BottomBar';
import { PhoneTitle } from '../phone/PhoneTitle';
import { AiIcon } from '../ui/ai-icon';
import { Avatar } from '../ui/avatar';
import { Ring } from '../ui/ring';
import { MAIL_TYPE_ICON } from './mailTypeIcons';

/** One fact in the round card: an icon or a ring, and a few words (mock #2 pills). */
export function Pill({
  icon,
  late = false,
  children,
}: {
  icon: ReactNode;
  late?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[31px] max-w-full items-center gap-1.5 rounded-full bg-[var(--glass-pill)] px-3 text-[14px] font-medium whitespace-nowrap',
        late ? 'text-late' : 'text-text-primary',
      )}
    >
      <span className={cn('flex shrink-0', late ? 'text-late' : 'text-text-secondary')}>
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * The top of a mail page (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #2, Linear's issue view):
 * a small grey "who · when" line, the subject big and bold, and "For ◔ company · role" like
 * Linear's "Sub-issue of", which opens the application.
 */
export function PhoneMailHeader({ detail }: { detail: ConversationDetail }) {
  const { conversation: c } = detail;
  const subject = c.subject || '(No subject)';
  const company = mailCompany(c);
  const when = c.lastReceivedAt ? format(new Date(c.lastReceivedAt), 'MMM d') : null;
  const who = [c.sender && parseSender(c.sender).name, when].filter(Boolean).join(' · ');
  const role = c.application?.jobTitle ?? c.role;
  const target = [company, role].filter(Boolean).join(' · ');
  return (
    <header className="flex flex-col px-0.5">
      {who && <p className="text-[13.5px] leading-[18px] text-text-secondary">{who}</p>}
      <PhoneTitle size="detail" barTitle={company ?? subject} className="pt-[3px] pb-2">
        {subject}
      </PhoneTitle>
      {target &&
        (c.application ? (
          <Link
            to="/applications/$id"
            params={{ id: c.application.id }}
            aria-label={`For ${target}. Open the application`}
            className="flex min-h-8 max-w-full items-center gap-[7px] self-start pb-3 text-[14px] active:opacity-50"
          >
            <span className="text-text-secondary">For</span>
            <Ring kind={statusTag(c.application.effectiveStatus).ring} />
            <span className="truncate">{target}</span>
          </Link>
        ) : (
          <p className="flex min-h-8 items-center gap-[7px] pb-3 text-[14px]">
            <span className="text-text-secondary">For</span>
            <span className="truncate">{target}</span>
          </p>
        ))}
    </header>
  );
}

/**
 * The facts as pills in one round card (mock #2): the status (or the kind of mail while there is
 * no application), when the step is due, the person, the company, and Probably fake. `status`: the
 * status pill, when the page makes it a button.
 */
export function PhoneMailPills({
  detail,
  status,
}: {
  detail: ConversationDetail;
  status?: ReactNode;
}) {
  const { conversation: c } = detail;
  const asked = c.request;
  // A missed step has left the list: its row below says "Missed", so no due date here.
  const due = asked && asked.state === 'OPEN' && !asked.missed ? shortDue(asked) : null;
  const sender = c.sender ? parseSender(c.sender).name : null;
  const company = mailCompany(c);
  const TypeIcon = c.category ? MAIL_TYPE_ICON[c.category] : null;
  return (
    <div
      role="group"
      aria-label="About this mail"
      className="mx-[-4px] mb-[18px] flex flex-wrap gap-[7px] rounded-[22px] bg-surface-subtle p-2"
    >
      {c.application
        ? (status ?? (
            <Pill icon={<Ring kind={statusTag(c.application.effectiveStatus).ring} />}>
              {statusTag(c.application.effectiveStatus).label}
            </Pill>
          ))
        : c.category &&
          TypeIcon && (
            <Pill icon={<TypeIcon size={15} aria-hidden="true" />}>
              {CATEGORY_LABEL[c.category]}
            </Pill>
          )}
      {due && asked && (
        <Pill icon={<ClockIcon size={15} aria-hidden="true" />} late={requestPastDue(asked)}>
          {due}
        </Pill>
      )}
      {sender && (
        <Pill icon={<Avatar name={sender} className="size-[19px] text-[8.5px]" />}>{sender}</Pill>
      )}
      {company && <Pill icon={<Building2Icon size={15} aria-hidden="true" />}>{company}</Pill>}
      {c.fakeOfferWarning && (
        <Pill icon={<TriangleAlertIcon size={15} aria-hidden="true" />} late>
          {FAKE_OFFER.tag}
        </Pill>
      )}
    </div>
  );
}

/** "Open in Gmail" as a glass circle: Gmail in prod, the mail sandbox in dev mode. */
function MailboxCircle({ threadId }: { threadId: string }) {
  const sandbox = useSandboxMailbox();
  const navigate = useNavigate();
  return (
    <BarCircle
      label={sandbox ? 'Open in the mail sandbox' : 'Open in Gmail'}
      onClick={() => {
        if (sandbox) void navigate({ to: '/sandbox/$threadId', params: { threadId } });
        else window.open(getGmailConversationUrl(threadId), '_blank', 'noopener,noreferrer');
      }}
    >
      <ExternalLinkIcon size={20} aria-hidden="true" />
    </BarCircle>
  );
}

/**
 * The bottom bar of a mail page (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #2): ✦ AI reply in a
 * glass circle, the Reply field ("Draft to Priya: …" while text is kept), and Open in Gmail in a
 * glass circle. The tab bar's glass turns into the field as the page slides in.
 */
export function PhoneMailBottomBar({
  detail,
  onReply,
  onAiReply,
}: {
  detail: ConversationDetail;
  onReply: () => void;
  onAiReply: () => void;
}) {
  const threadId = detail.conversation.threadId;
  if (!threadId) return null;
  return (
    <BottomBar
      threadId={threadId}
      sender={detail.conversation.sender}
      onReply={onReply}
      onAiReply={onAiReply}
    />
  );
}

function BottomBar({
  threadId,
  sender,
  onReply,
  onAiReply,
}: {
  threadId: string;
  sender: string | null;
  onReply: () => void;
  onAiReply: () => void;
}) {
  const kept = useKeptReply(threadId);
  const thread = useMailThread(threadId);
  // Nobody reads mail sent to this address (owner, 26 Nov 2026): no AI reply and no Reply field.
  // The bar only says so, with no glass behind the words, and Open in Gmail stays.
  if (thread.data?.canReply === false)
    return (
      <PhoneBottomBar label="Mail actions">
        <p className="min-w-0 flex-1 truncate pl-2 text-[16px] text-text-tertiary">
          {NO_REPLY_SHORT}
        </p>
        <MailboxCircle threadId={threadId} />
      </PhoneBottomBar>
    );
  const to = thread.data?.replyTo ?? sender;
  const name = to ? parseSender(to).name : null;
  let words: ReactNode = name ? `Reply to ${name}` : 'Reply';
  if (kept)
    words = (
      <>
        <span className="font-semibold text-text-primary">Draft</span>
        {name && ` to ${name}`}: {docWords(kept)}
      </>
    );
  return (
    <PhoneBottomBar label="Mail actions">
      <BarCircle label="AI reply" onClick={onAiReply}>
        <AiIcon size={20} aria-hidden="true" />
      </BarCircle>
      <BarField
        icon={<ReplyIcon aria-hidden="true" />}
        aria-label={kept ? 'Open draft' : 'Reply'}
        onClick={onReply}
      >
        {words}
      </BarField>
      <MailboxCircle threadId={threadId} />
    </PhoneBottomBar>
  );
}
