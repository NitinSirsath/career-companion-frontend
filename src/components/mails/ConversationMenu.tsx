import type { Conversation } from '../../contracts/conversation';
import { OverflowMenu } from '../ui/menu';
import { useConversationActions } from './useConversationActions';

/** The "…" beside Reply, with the conversation's actions. */
export function ConversationMenu({ conversation }: { conversation: Conversation }) {
  const { actions, dialog, more } = useConversationActions(conversation);
  return (
    <>
      <OverflowMenu label="More for this conversation" triggerRef={more} actions={actions} />
      {dialog}
    </>
  );
}
