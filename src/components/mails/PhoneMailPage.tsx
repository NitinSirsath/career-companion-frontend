import { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { useLocation } from '@tanstack/react-router';
import {
  BanIcon,
  CalendarDaysIcon,
  CircleCheckIcon,
  EllipsisIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react';
import type { ConversationDetail } from '../../contracts/conversation';
import { modelName } from '../../lib/aiLabels';
import { holdKeyboard } from '../../lib/holdKeyboard';
import { askingMessageId, readingAbove } from '../../lib/mailThread';
import { cn } from '../../lib/utils';
import { TopBarActions } from '../layout/Breadcrumb';
import { CapsuleButton, GlassCapsule } from '../phone/GlassButton';
import { InlineNotification } from '../ui/notification';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';
import { FakeOfferNotice } from './FakeOffer';
import { MailThreadView } from './MailThreadView';
import { PhoneMailBottomBar, PhoneMailHeader, PhoneMailPills } from './PhoneMailParts';
import { PhoneMailStatus } from './PhoneMailStatus';
import { PhoneJobMailInfo, PhoneJobMailTop } from './PhoneJobMail';
import { useConversationActions } from './useConversationActions';
import { useStepDone } from './useStepDone';

type AiStart = { choice: string | null };

const MENU_ROW = cn(ITEM_CLASS, 'min-h-11 justify-start gap-3 text-[17px]');

/** The conversation as activity, with the reply that the bottom bar opens. */
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
    <div className="phone-bleed mt-3.5">
      <MailThreadView
        threadId={conversation.threadId}
        job={{
          mails: detail.mails,
          askingMessageId: askingMessageId(detail),
          readingShownAbove: readingAbove(detail)?.gmailMessageId ?? null,
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

/**
 * Done (or Reopen) and ··· in one glass capsule at the top right (mock #2). ··· holds the key
 * dates and the application, then Block and Delete.
 */
function PhoneMailTools({ detail, onInfo }: { detail: ConversationDetail; onInfo: () => void }) {
  const step = useStepDone(detail);
  const more = useConversationActions(detail.conversation);
  return (
    <>
      <TopBarActions>
        <GlassCapsule label="Mail tools">
          {step && (
            <CapsuleButton label={step.label} onClick={step.run} disabled={step.busy}>
              {step.label === 'Done' ? (
                <CircleCheckIcon size={20} aria-hidden="true" />
              ) : (
                <RotateCcwIcon size={20} aria-hidden="true" />
              )}
            </CapsuleButton>
          )}
          <Menu.Root>
            <Menu.Trigger render={<CapsuleButton label="More" />}>
              <EllipsisIcon size={20} aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={8} className="z-50 outline-none">
                <Menu.Popup className={cn(POPUP_CLASS, 'phone-type min-w-60 rounded-[18px]')}>
                  <Menu.Item className={MENU_ROW} onClick={onInfo}>
                    <CalendarDaysIcon size={18} aria-hidden="true" className="shrink-0" />
                    Key dates and application
                  </Menu.Item>
                  <Menu.Separator className="my-1 h-px bg-border-subtle" />
                  {more.actions.map((action) => (
                    <Menu.Item
                      key={action.label}
                      disabled={action.disabled}
                      className={cn(MENU_ROW, action.danger && 'text-danger-text')}
                      onClick={action.onSelect}
                    >
                      {action.danger ? (
                        <Trash2Icon size={18} aria-hidden="true" className="shrink-0" />
                      ) : (
                        <BanIcon size={18} aria-hidden="true" className="shrink-0" />
                      )}
                      {action.label}
                    </Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </GlassCapsule>
      </TopBarActions>
      {more.dialog}
    </>
  );
}

/**
 * A job mail on a phone (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` #2, Linear's issue view): a
 * grey "who · when" line, the subject big and bold, "For ◔ company · role", the facts as pills in
 * one round card, the next step with the AI's reading under it, and the mails as activity. At the
 * bottom: ✦ AI reply · Reply · Open in Gmail.
 */
export function PhoneMailPage({ detail }: { detail: ConversationDetail }) {
  const { conversation } = detail;
  const [replyAsks, setReplyAsks] = useState(0);
  const [aiStart, setAiStart] = useState<AiStart | null>(null);
  const [info, setInfo] = useState(false);
  const [statusNotice, setStatusNotice] = useState<HTMLElement | null>(null);
  const reply = (start: AiStart | null) => {
    holdKeyboard();
    setAiStart(start);
    setReplyAsks((asks) => asks + 1);
  };
  return (
    <div className="flex flex-col">
      <PhoneMailTools detail={detail} onInfo={() => setInfo(true)} />
      <PhoneMailHeader detail={detail} />
      <PhoneMailPills
        detail={detail}
        status={
          conversation.application && (
            <PhoneMailStatus application={conversation.application} noticePlace={statusNotice} />
          )
        }
      />
      <div ref={setStatusNotice} className="empty:hidden [&>*]:mb-4" />
      {conversation.fakeOfferWarning && (
        <div className="pb-4">
          <FakeOfferNotice reason={conversation.fakeOfferWarning} />
        </div>
      )}
      <PhoneJobMailTop detail={detail} />
      <PhoneThread
        detail={detail}
        aiStart={aiStart}
        onStarted={() => setAiStart(null)}
        replyAsks={replyAsks}
      />
      <PhoneMailBottomBar
        detail={detail}
        onReply={() => reply(null)}
        // The reply opens with the AI's choices and the hint box ready (owner, 13 Nov 2026).
        onAiReply={() => reply({ choice: null })}
      />
      <PhoneJobMailInfo detail={detail} open={info} onOpenChange={setInfo} />
    </div>
  );
}
