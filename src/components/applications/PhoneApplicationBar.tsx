import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useConversations } from '../../api/conversations';
import type { Conversation } from '../../contracts/conversation';
import { OPEN_REPLY } from '../../lib/openReply';
import { mailDate, parseSender } from '../../lib/mails';
import { ActionBar as PhoneActionBar, type PhoneAction } from '../phone/ActionBar';
import { EllipsisIcon as MoreIcon, ReplyIcon, TagIcon as StatusIcon } from 'lucide-react';
import type { MenuAction } from '../ui/menu';
import { ActionSheet, Sheet, SheetAction, SheetGroup } from '../ui/sheet';

/** Newest first, by the last mail. */
const newestFirst = (a: Conversation, b: Conversation) =>
  (b.lastReceivedAt ?? '').localeCompare(a.lastReceivedAt ?? '');

/**
 * The action bar of an application on a phone (owner, 12 Nov 2026, approved mock
 * `PHONE-DETAIL-mock/`): Reply answers the newest mail (a sheet asks which conversation when there
 * are several; no Reply without one), Status opens the status sheet, More has Archive or Restore
 * and Delete.
 */
export function PhoneApplicationBar({
  applicationId,
  onStatus,
  canPick,
  actions,
}: {
  applicationId: string;
  onStatus: () => void;
  canPick: boolean;
  actions: readonly MenuAction[];
}) {
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<'which' | 'more' | null>(null);
  const { data } = useConversations({ application: applicationId }, 0);
  const conversations = [...(data?.items ?? [])].filter((c) => c.threadId).sort(newestFirst);
  const replyTo = (conversation: Conversation) =>
    void navigate({ to: '/mails/$key', params: { key: conversation.key }, state: OPEN_REPLY });
  const bar: PhoneAction[] = [];
  if (conversations.length > 0)
    bar.push({
      label: 'Reply',
      icon: <ReplyIcon size={24} />,
      onClick: () => (conversations.length === 1 ? replyTo(conversations[0]) : setSheet('which')),
    });
  bar.push({
    label: 'Status',
    icon: <StatusIcon size={24} />,
    onClick: onStatus,
    disabled: !canPick,
  });
  if (actions.length > 0)
    bar.push({ label: 'More', icon: <MoreIcon size={24} />, onClick: () => setSheet('more') });
  const sheetProps = (name: 'which' | 'more') => ({
    open: sheet === name,
    onOpenChange: (open: boolean) => setSheet(open ? name : null),
  });
  return (
    <>
      <PhoneActionBar label="Application actions" actions={bar} />
      <Sheet {...sheetProps('which')} title="Reply to which conversation?">
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
      <ActionSheet {...sheetProps('more')} title="This application" actions={actions} />
    </>
  );
}
