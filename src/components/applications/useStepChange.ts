import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApplicationActionListItem } from '../../contracts/application';
import { stepText } from '../../lib/applicationDetail';
import { MISSED } from '../../lib/missed';
import { showToast } from '../ui/toast';

/**
 * Completes, dismisses or reopens one step, and reads every list that shows it again. A step
 * from a mail is that mail's request too, so the Mails lists and the Dashboard's count follow.
 */
function useStepUpdate(action: ApplicationActionListItem) {
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const key of [
      'application-actions',
      'applications',
      'actions',
      'workspace',
      'conversations',
      'dashboard',
    ])
      void queryClient.invalidateQueries({ queryKey: [key] });
    void queryClient.invalidateQueries({ queryKey: ['application', action.applicationId] });
  };
  return useMutation({
    retry: false,
    mutationFn: ({
      status,
      revision,
    }: {
      status: 'PENDING' | 'COMPLETED' | 'DISMISSED';
      revision: number;
    }) => api.updateAction(action.id, { status, expectedActionRevision: revision }),
    onSettled: refresh,
  });
}

/**
 * Changes a step and says so, with Undo. `stillOpen` is for a missed step: it is pending already,
 * so the server only puts it back in Needs action, for 7 days; nothing sets it back to missed.
 */
export function useStepChange(action: ApplicationActionListItem) {
  const update = useStepUpdate(action);
  const text = stepText(action);
  const change = (status: 'COMPLETED' | 'DISMISSED') =>
    update.mutate(
      { status, revision: action.actionRevision },
      {
        onSuccess: (saved) =>
          showToast(`${status === 'COMPLETED' ? 'Done' : 'Dismissed'}: ${text}`, {
            undo: () => update.mutate({ status: 'PENDING', revision: saved.actionRevision }),
          }),
      },
    );
  const stillOpen = () =>
    update.mutate(
      { status: 'PENDING', revision: action.actionRevision },
      { onSuccess: () => showToast(`${MISSED.stillOpen}: ${text}`) },
    );
  return { update, change, stillOpen };
}
