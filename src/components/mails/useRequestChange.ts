import { useSetRequestState } from '../../api/conversations';
import type { Conversation } from '../../contracts/conversation';
import { requestControls, requestTitle, type RequestControl } from '../../lib/mails';
import { showToast } from '../ui/toast';

/**
 * Changes what a conversation's request needs ("I did this", "Reopen", "Ask me again") and says
 * so in a toast that can undo it. Shared by a row's "…" menu and the phone row's swipe.
 */
export function useRequestChange(conversation: Conversation) {
  const change = useSetRequestState(conversation.key);
  const asked = conversation.request;
  const controls = asked ? requestControls(asked) : [];
  const apply = (control: RequestControl) => {
    if (!asked) return;
    const title = requestTitle(asked);
    // The server can set a request back to open or done, not to replied: no Undo from replied.
    const before = asked.state === 'REPLIED' ? null : asked.state;
    change.mutate(
      { emailId: asked.emailId, state: control.state },
      {
        onSuccess: () =>
          showToast(`${control.state === 'DONE' ? 'Done' : 'Updated'}: ${title}`, {
            undo: before
              ? () => change.mutate({ emailId: asked.emailId, state: before })
              : undefined,
          }),
      },
    );
  };
  return { controls, apply, pending: change.isPending };
}
