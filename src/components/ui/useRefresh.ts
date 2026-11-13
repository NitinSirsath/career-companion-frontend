import { useState } from 'react';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { OFFLINE_REFRESH } from '../../lib/offline';
import { showToast } from './toast';

/** The spin lasts at least this long, so a quick refresh is still seen to happen. */
const MIN_SPIN_MS = 600;
/** A refresh that hangs (a slow server) stops spinning after this; its answers still land. */
const MAX_SPIN_MS = 8000;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The refresh icon (↻) on every list (owner, 13 Nov 2026): fetches again what the page shows, so
 * nobody has to reload the app. `also`: more to do first, such as asking Gmail for new mail.
 */
export function useRefresh(also?: () => unknown) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
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
  return { busy, refresh };
}
