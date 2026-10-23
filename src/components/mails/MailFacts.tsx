import type { ReactNode } from 'react';
import { Building, Portfolio, type CarbonIconType } from '@carbon/icons-react';
import { useMailThread } from '../../api/mailbox';
import type { Conversation } from '../../contracts/conversation';
import { mailCounts } from '../../lib/mails';
import { StatusBadge } from '../ApplicationStatus';
import { Tag } from '../ui/tag';
import { FakeOfferTag } from './FakeOffer';
import { MailType } from './MailType';

/** "3 mails · 1 from you", counted in the conversation as Gmail has it now. */
function LiveMailCount({ threadId }: { threadId: string }) {
  const { data } = useMailThread(threadId);
  if (!data) return null;
  const fromYou = data.messages.filter((message) => message.sentByUser).length;
  return <span>{mailCounts(data.messages.length, fromYou)}</span>;
}

/** One fact with its icon. */
function Fact({ icon: Icon, children }: { icon: CarbonIconType; children: ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Icon size={16} aria-hidden="true" className="shrink-0" />
      <span className="break-words">{children}</span>
    </span>
  );
}

/**
 * The row of facts under a job mail's title: the company, the role, the application's status (or
 * the kind of mail when there is no application), Probably fake, how many mails, and New.
 */
export function MailFacts({ conversation }: { conversation: Conversation }) {
  return (
    <>
      {conversation.company && <Fact icon={Building}>{conversation.company}</Fact>}
      {conversation.role && <Fact icon={Portfolio}>{conversation.role}</Fact>}
      {conversation.application ? (
        <StatusBadge status={conversation.application.effectiveStatus} />
      ) : (
        conversation.category && <MailType category={conversation.category} />
      )}
      {conversation.fakeOfferWarning && <FakeOfferTag />}
      {conversation.threadId ? (
        <LiveMailCount threadId={conversation.threadId} />
      ) : (
        <span>{mailCounts(conversation.mailCount, conversation.sentCount)}</span>
      )}
      {conversation.isNew && <Tag color="blue">New</Tag>}
    </>
  );
}
