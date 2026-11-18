import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import type { GmailStatusResponse } from '../../contracts/gmail';

/** How far back the first sync reads (Gmail sync page). */
export const LOOKBACK = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days (default)' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
] as const;

export function syncProblem(error: unknown): string {
  if (isApiError(error) && (error.code === 'SYNC_IN_PROGRESS' || error.status === 409))
    return 'A sync is already running.';
  return 'The sync did not start. Try again in a moment.';
}

/** Saves how far back a sync looks; `value` is the choice shown, also while it is saved. */
export function useLookbackSave(status: GmailStatusResponse) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (days: number) => api.updateGmailSettings({ syncLookbackDays: days }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['gmailStatus'] }),
  });
  const value = String(save.isPending ? save.variables : (status.syncLookbackDays ?? 1));
  const chosen = LOOKBACK.find((option) => option.value === value);
  return { save, value, chosen };
}

/** "How far the first sync reads…": the look-back choice's help. */
export const LOOKBACK_HELP =
  'How far the first sync reads. After that, each sync reads everything since the last one, up to 30 days.';
