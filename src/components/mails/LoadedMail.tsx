import { useState, type ReactNode } from 'react';
import type { ConversationDetail } from '../../contracts/conversation';
import { modelName } from '../../lib/aiLabels';
import { askingMessageId } from '../../lib/mailThread';
import { useIsPhone } from '../layout/useIsPhone';
import { InlineNotification } from '../ui/notification';
import { ConversationMenu } from './ConversationMenu';
import { FakeOfferNotice } from './FakeOffer';
import { JobMailPanel } from './JobMailPanel';
import { MailFacts } from './MailFacts';
import { MailThreadView } from './MailThreadView';
import { MailTitle } from './MailTitle';
import { PhoneMailPage } from './PhoneMailPage';

/** The page once the mail is read: phones have their own layout (owner, 12 Nov 2026). */
export function LoadedMail({
  detail,
  breadcrumb,
}: {
  detail: ConversationDetail;
  breadcrumb: ReactNode;
}) {
  const { conversation } = detail;
  // Counts the header's Reply clicks; each one opens the reply box under the conversation.
  const [replyAsks, setReplyAsks] = useState(0);
  const phone = useIsPhone();
  if (phone) return <PhoneMailPage detail={detail} />;
  return (
    <>
      <MailTitle
        title={conversation.subject || '(No subject)'}
        threadId={conversation.threadId}
        breadcrumb={breadcrumb}
        onReply={() => setReplyAsks((asks) => asks + 1)}
        more={<ConversationMenu conversation={conversation} />}
      >
        <MailFacts conversation={conversation} />
      </MailTitle>
      {conversation.fakeOfferWarning && <FakeOfferNotice reason={conversation.fakeOfferWarning} />}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {conversation.threadId ? (
            <MailThreadView
              threadId={conversation.threadId}
              job={{
                mails: detail.mails,
                askingMessageId: askingMessageId(detail),
                ai: {
                  conversationKey: conversation.key,
                  // A mail that asks for money never gets reply choices.
                  choices: conversation.fakeOfferWarning ? [] : detail.replyChoices,
                  model: conversation.analyzedBy
                    ? modelName(conversation.analyzedBy.provider, conversation.analyzedBy.model)
                    : null,
                },
              }}
              replyAsks={replyAsks}
            />
          ) : (
            <InlineNotification>
              Gmail gave this mail no conversation, so its text cannot be shown here.
            </InlineNotification>
          )}
        </div>
        <JobMailPanel detail={detail} />
      </div>
    </>
  );
}
