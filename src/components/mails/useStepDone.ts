import { useSetRequestState } from '../../api/conversations';
import type { ConversationDetail } from '../../contracts/conversation';
import { closesByHand, fakeOfferStep, requestTitle } from '../../lib/mails';
import { showToast } from '../ui/toast';

/** What a step's button does on a phone: Done while it may be done by hand, Reopen once closed. */
export function useStepDone(detail: ConversationDetail): {
  label: 'Done' | 'Reopen';
  run: () => void;
  busy: boolean;
} | null {
  const { conversation } = detail;
  const change = useSetRequestState(conversation.key);
  const asked = conversation.request;
  if (!asked) return null;
  const title = requestTitle(asked);
  const fake = fakeOfferStep(conversation);
  if (asked.state === 'OPEN' && closesByHand(asked) && !fake)
    return {
      label: 'Done',
      busy: change.isPending,
      run: () =>
        change.mutate(
          { emailId: asked.emailId, state: 'DONE' },
          {
            onSuccess: () =>
              showToast(`Done: ${title}`, {
                undo: () => change.mutate({ emailId: asked.emailId, state: 'OPEN' }),
              }),
          },
        ),
    };
  // Replied or done: one word, Reopen, puts it back on the list (owner, 13 Nov 2026).
  if (asked.state !== 'OPEN')
    return {
      label: 'Reopen',
      busy: change.isPending,
      run: () =>
        change.mutate(
          { emailId: asked.emailId, state: 'OPEN' },
          { onSuccess: () => showToast(`Reopened: ${title}`) },
        ),
    };
  return null;
}
