import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { GmailStatusResponse } from '../contracts/gmail';
import { startProcessingRefresh } from '../lib/processingRefresh';
import { api } from './client';

export const gmailStatusKey = ['gmailStatus'] as const;

/** Whether Gmail is connected, and when it last and next syncs. Polls while a sync runs. */
export function useGmailStatus() {
  return useQuery({
    queryKey: gmailStatusKey,
    queryFn: ({ signal }) => api.getGmailStatus({ signal }),
    refetchInterval: (query) => (query.state.data?.syncStatus === 'SYNCING' ? 2000 : false),
  });
}

/**
 * The server has started a sync: say so at once, so a "Sync now" button stays busy until a fresh
 * status says the sync is over, instead of flicking back for one round trip.
 */
export function markSyncing(queryClient: QueryClient) {
  queryClient.setQueryData<GmailStatusResponse>(gmailStatusKey, (status) =>
    status ? { ...status, syncStatus: 'SYNCING' } : status,
  );
}

/**
 * Starts a sync. An accepted request, or one whose answer was lost, may still run on the server,
 * so the lists refresh for a while either way.
 */
export function useSyncNow(onAccepted?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.triggerSync(),
    onSuccess: () => {
      markSyncing(queryClient);
      onAccepted?.();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: gmailStatusKey });
      void queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
      startProcessingRefresh();
    },
  });
}
