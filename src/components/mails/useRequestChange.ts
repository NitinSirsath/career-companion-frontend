import { useSetRequestState } from '../../api/conversations';
import type { Conversation } from '../../contracts/conversation';
import { requestControls, requestTitle, type RequestControl } from '../../lib/mails';
import { MISSED } from '../../lib/missed';
import { showToast } from '../ui/toast';

/** What the toast says was done: "Still open" is the one change that leaves an open request open. */
function said(control: RequestControl, from: 'OPEN' | 'REPLIED' | 'DONE'): string {
  if (control.state === 'DONE') return 'Done';
  return from === 'OPEN' ? MISSED.stillOpen : 'Reopened';
}

/**
 * Changes what a conversation's request needs ("I did this", "Reopen", "Still open") and says
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
    // "Still open" has no Undo either: nothing sets a request back to missed.
    const before = asked.state === 'REPLIED' || asked.state === control.state ? null : asked.state;
    change.mutate(
      { emailId: asked.emailId, state: control.state },
      {
        onSuccess: () =>
          showToast(`${said(control, asked.state)}: ${title}`, {
            undo: before
              ? () => change.mutate({ emailId: asked.emailId, state: before })
              : undefined,
          }),
      },
    );
  };
  return { controls, apply, pending: change.isPending };
}
