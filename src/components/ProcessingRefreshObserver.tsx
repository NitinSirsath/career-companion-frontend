import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AISettingsResponse } from '../contracts/ai';
import type { GmailStatusResponse } from '../contracts/gmail';
import { nothingCanChange } from '../lib/aiWaiting';
import {
  DOMAIN_QUERY_KEYS,
  PROCESSING_REFRESH_INTERVAL_MS,
  getProcessingRefreshUntil,
  startProcessingRefresh,
  subscribeProcessingRefresh,
} from '../lib/processingRefresh';

/**
 * Mounted once in the authenticated shell so it survives route changes. A completed ingestion
 * (new lastSyncedAt) or an accepted/uncertain sync or retry opens a bounded refresh window.
 * The window closes early once a reload made inside it shows that nothing can change: no sync is
 * running and AI cannot read mail right now.
 */
export function ProcessingRefreshObserver() {
  const queryClient = useQueryClient();
  const refreshUntil = useSyncExternalStore(subscribeProcessingRefresh, getProcessingRefreshUntil);
  const seenSync = useRef<string | null | undefined>(undefined);

  const { data: status } = useQuery({
    queryKey: ['gmailStatus'],
    queryFn: ({ signal }) => api.getGmailStatus({ signal }),
    refetchInterval: (query) => {
      const current = query.state.data;
      if (current?.syncStatus === 'SYNCING') return 2000;
      if (!current?.nextScheduledSyncAt) return false;
      const next = Date.parse(current.nextScheduledSyncAt);
      return Number.isFinite(next) ? Math.max(60_000, next + 60_000 - Date.now()) : false;
    },
  });

  const lastSyncedAt = status?.lastSyncedAt ? String(status.lastSyncedAt) : null;
  useEffect(() => {
    if (status === undefined) return;
    if (seenSync.current !== undefined && lastSyncedAt && lastSyncedAt !== seenSync.current) {
      startProcessingRefresh();
    }
    seenSync.current = lastSyncedAt;
  }, [status, lastSyncedAt]);

  useEffect(() => {
    if (refreshUntil <= Date.now()) return;
    const openedAt = Date.now();
    const refresh = () => {
      for (const key of DOMAIN_QUERY_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
    };
    // Only answers loaded inside this window count: older ones may predate what opened it.
    const loadedInWindow = <T,>(key: string) => {
      const state = queryClient.getQueryState<T>([key]);
      return state && state.dataUpdatedAt > openedAt ? state.data : undefined;
    };
    const settled = () => {
      const gmail = loadedInWindow<GmailStatusResponse>('gmailStatus');
      const ai = loadedInWindow<AISettingsResponse>('aiSettings');
      return !!gmail && !!ai && nothingCanChange(gmail, ai);
    };
    refresh();
    const timer = setInterval(() => {
      if (Date.now() >= refreshUntil || settled()) clearInterval(timer);
      else refresh();
    }, PROCESSING_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refreshUntil, queryClient]);

  return null;
}
