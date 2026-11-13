import { useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import {
  BanIcon,
  CircleCheckIcon,
  EllipsisIcon,
  InfoIcon,
  ReplyIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react';
import type { ConversationDetail } from '../../contracts/conversation';
import { modelName } from '../../lib/aiLabels';
import { useKeptReply } from '../../lib/keptReply';
import { holdKeyboard } from '../../lib/holdKeyboard';
import { askingMessageId } from '../../lib/mailThread';
import { TopBarActions } from '../layout/Breadcrumb';
import { ActionBar, type PhoneAction } from '../phone/ActionBar';
import { GlassButton } from '../phone/GlassButton';
import { PhoneTitle } from '../phone/PhoneTitle';
import { AiIcon } from '../ui/ai-icon';
import { InlineNotification } from '../ui/notification';
import { ActionSheet } from '../ui/sheet';
import { FakeOfferNotice } from './FakeOffer';
import { MailFacts } from './MailFacts';
import { MailThreadView } from './MailThreadView';
import { MailboxLink } from './MailTitle';
import { PhoneJobMailInfo, PhoneJobMailTop } from './PhoneJobMail';
import { useConversationActions } from './useConversationActions';
import { useStepDone } from './useStepDone';

type AiStart = { choice: string | null };

/** The big subject, the facts under it and the way to the mailbox. */
function PhoneMailHeader({ detail }: { detail: ConversationDetail }) {
  const { conversation } = detail;
  const subject = conversation.subject || '(No subject)';
  const company = conversation.company ?? conversation.application?.companyName ?? undefined;
  return (
    <header className="flex flex-col gap-[9px] px-1 pt-0.5 pb-[18px]">
      <PhoneTitle size="detail" barTitle={company ?? subject}>
        {subject}
      </PhoneTitle>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px] text-text-secondary">
        <MailFacts conversation={conversation} />
      </div>
      {conversation.threadId && <MailboxLink threadId={conversation.threadId} subject={subject} />}
      {conversation.fakeOfferWarning && <FakeOfferNotice reason={conversation.fakeOfferWarning} />}
    </header>
  );
}

/** The conversation edge to edge, with the reply that the action bar opens. */
function PhoneThread({
  detail,
  aiStart,
  onStarted,
  replyAsks,
}: {
  detail: ConversationDetail;
  aiStart: AiStart | null;
  onStarted: () => void;
  replyAsks: number;
}) {
  const { conversation } = detail;
  // "Reply" on the application page brings the user here with the reply open.
  const startReply = useLocation({ select: (location) => !!location.state.openReply });
  if (!conversation.threadId)
    return (
      <InlineNotification>
        Gmail gave this mail no conversation, so its text cannot be shown here.
      </InlineNotification>
    );
  return (
    <div className="-mx-4 mt-3.5">
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
            start: aiStart,
            onStarted,
          },
        }}
        replyAsks={replyAsks}
        startReply={startReply}
      />
    </div>
  );
}

/** The action bar's buttons: Reply (or Draft), Done or Reopen when the step has one, AI reply, More. */
function usePhoneMailActions(
  detail: ConversationDetail,
  reply: (start: AiStart | null) => void,
  onMore: () => void,
): PhoneAction[] {
  const threadId = detail.conversation.threadId;
  const kept = useKeptReply(threadId ?? '');
  const step = useStepDone(detail);
  const actions: PhoneAction[] = [];
  if (threadId)
    actions.push({
      label: kept ? 'Draft' : 'Reply',
      ariaLabel: kept ? 'Open draft' : 'Reply',
      icon: <ReplyIcon size={24} aria-hidden="true" />,
      onClick: () => reply(null),
    });
  if (step)
    actions.push({
      label: step.label,
      icon:
        step.label === 'Done' ? (
          <CircleCheckIcon size={24} aria-hidden="true" />
        ) : (
          <RotateCcwIcon size={24} aria-hidden="true" />
        ),
      onClick: step.run,
      disabled: step.busy,
    });
  if (threadId)
    actions.push({
      label: 'AI reply',
      icon: <AiIcon size={24} aria-hidden="true" />,
      // The reply opens with the AI's choices and the hint box ready (owner, 13 Nov 2026).
      onClick: () => reply({ choice: null }),
    });
  actions.push({
    label: 'More',
    icon: <EllipsisIcon size={24} aria-hidden="true" />,
    onClick: onMore,
  });
  return actions;
}

/**
 * A job mail on a phone (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): the big subject, the
 * facts, the next step as one row, the mails edge to edge, and a floating action bar with Reply,
 * Done, AI reply and More. Key dates and the application are behind ⓘ.
 */
export function PhoneMailPage({ detail }: { detail: ConversationDetail }) {
  const { conversation } = detail;
  const [replyAsks, setReplyAsks] = useState(0);
  const [aiStart, setAiStart] = useState<AiStart | null>(null);
  const [sheet, setSheet] = useState<'info' | 'more' | null>(null);
  const more = useConversationActions(conversation);
  const sheetProps = (name: 'info' | 'more') => ({
    open: sheet === name,
    onOpenChange: (open: boolean) => setSheet(open ? name : null),
  });
  const reply = (start: AiStart | null) => {
    holdKeyboard();
    setAiStart(start);
    setReplyAsks((asks) => asks + 1);
  };
  const actions = usePhoneMailActions(detail, reply, () => setSheet('more'));
  return (
    <div className="flex flex-col">
      <TopBarActions>
        <GlassButton label="About this job mail" onClick={() => setSheet('info')}>
          <InfoIcon size={23} aria-hidden="true" />
        </GlassButton>
      </TopBarActions>
      <PhoneMailHeader detail={detail} />
      <PhoneJobMailTop detail={detail} />
      <PhoneThread
        detail={detail}
        aiStart={aiStart}
        onStarted={() => setAiStart(null)}
        replyAsks={replyAsks}
      />
      <ActionBar label="Mail actions" actions={actions} />
      <PhoneJobMailInfo detail={detail} {...sheetProps('info')} />
      <ActionSheet
        {...sheetProps('more')}
        title="This conversation"
        actions={more.actions.map((action) => ({
          ...action,
          icon: action.danger ? (
            <Trash2Icon size={22} aria-hidden="true" />
          ) : (
            <BanIcon size={22} aria-hidden="true" />
          ),
        }))}
      />
      {more.dialog}
    </div>
  );
}
