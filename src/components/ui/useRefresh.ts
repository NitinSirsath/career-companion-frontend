import { useState } from 'react';
import { onlineManager, useIsFetching, useQueryClient } from '@tanstack/react-query';
import { OFFLINE_REFRESH } from '../../lib/offline';
import { showToast } from './toast';

/** The spin lasts at least this long, so a quick refresh is still seen to happen. */
const MIN_SPIN_MS = 600;
/** A refresh that hangs (a slow server) stops spinning after this; its answers still land. */
const MAX_SPIN_MS = 8000;
/**
 * Data at least this old that is fetched again on its own also turns the icon: the page shows the
 * copy saved on this device while it checks for new data, as phone mail apps do (owner, 17 Nov
 * 2026). Fresher data, such as a list that polls, does not, so the icon is not always turning.
 */
const SAVED_COPY_MS = 60_000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The refresh icon (↻) on every list (owner, 13 Nov 2026): fetches again what the page shows, so
 * nobody has to reload the app. `also`: more to do first, such as asking Gmail for new mail.
 */
export function useRefresh(also?: () => unknown) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const checking =
    useIsFetching({
      type: 'active',
      predicate: (query) =>
        query.state.data !== undefined && Date.now() - query.state.dataUpdatedAt >= SAVED_COPY_MS,
    }) > 0;
  const refresh = async () => {
    if (busy) return;
    if (!onlineManager.isOnline()) {
      showToast(OFFLINE_REFRESH, { offline: true });
      return;
    }
    setBusy(true);
    try {
      also?.();
      const fetched = queryClient.refetchQueries({ type: 'active' });
      await Promise.all([Promise.race([fetched, wait(MAX_SPIN_MS)]), wait(MIN_SPIN_MS)]);
      showToast('Up to date.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, checking, refresh };
}
