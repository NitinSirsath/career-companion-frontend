import { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { useNavigate } from '@tanstack/react-router';
import { EllipsisIcon, ReplyIcon } from 'lucide-react';
import { useConversations } from '../../api/conversations';
import type { Conversation } from '../../contracts/conversation';
import { OPEN_REPLY } from '../../lib/openReply';
import { mailDate, parseSender } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { TopBarActions } from '../layout/Breadcrumb';
import { CapsuleButton, GlassCapsule } from '../phone/GlassButton';
import type { MenuAction } from '../ui/menu';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';
import { Sheet, SheetAction, SheetGroup } from '../ui/sheet';

const ROW = cn(ITEM_CLASS, 'min-h-11 justify-start gap-3 text-[17px]');

/** Newest first, by the last mail. */
const newestFirst = (a: Conversation, b: Conversation) =>
  (b.lastReceivedAt ?? '').localeCompare(a.lastReceivedAt ?? '');

/**
 * The ··· of an application on a phone (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 6),
 * in the top bar's glass capsule: Reply answers the newest mail (a sheet asks which conversation
 * when there are several; no Reply without one), then Archive or Restore and Delete. The status
 * changes from its pill on the page.
 */
export function PhoneApplicationMore({
  applicationId,
  actions,
}: {
  applicationId: string;
  actions: readonly MenuAction[];
}) {
  const navigate = useNavigate();
  const [choosing, setChoosing] = useState(false);
  const { data } = useConversations({ application: applicationId }, 0);
  const conversations = [...(data?.items ?? [])].filter((c) => c.threadId).sort(newestFirst);
  const replyTo = (conversation: Conversation) =>
    void navigate({ to: '/mails/$key', params: { key: conversation.key }, state: OPEN_REPLY });
  const reply = () => (conversations.length === 1 ? replyTo(conversations[0]) : setChoosing(true));
  if (conversations.length === 0 && actions.length === 0) return null;
  return (
    <>
      <TopBarActions>
        <GlassCapsule label="Application tools">
          <Menu.Root>
            <Menu.Trigger render={<CapsuleButton label="More" />}>
              <EllipsisIcon size={22} aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner align="end" sideOffset={8} className="z-50 outline-none">
                <Menu.Popup className={cn(POPUP_CLASS, 'phone-type min-w-60 rounded-[18px]')}>
                  {conversations.length > 0 && (
                    <Menu.Item className={ROW} onClick={reply}>
                      <ReplyIcon size={18} aria-hidden="true" />
                      Reply
                    </Menu.Item>
                  )}
                  {actions.map((action) => (
                    <Menu.Item
                      key={action.label}
                      disabled={action.disabled}
                      className={cn(ROW, action.danger && 'text-danger-text')}
                      onClick={action.onSelect}
                    >
                      {action.icon}
                      {action.label}
                    </Menu.Item>
                  ))}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </GlassCapsule>
      </TopBarActions>
      <Sheet open={choosing} onOpenChange={setChoosing} title="Reply to which conversation?">
        <SheetGroup>
          {conversations.map((conversation) => (
            <SheetAction key={conversation.key} onClick={() => replyTo(conversation)}>
              <span className="block truncate">{conversation.subject || '(No subject)'}</span>
              <span className="block truncate text-[15px] text-text-secondary">
                {parseSender(conversation.sender).name} · {mailDate(conversation.lastReceivedAt)}
              </span>
            </SheetAction>
          ))}
        </SheetGroup>
      </Sheet>
    </>
  );
}
