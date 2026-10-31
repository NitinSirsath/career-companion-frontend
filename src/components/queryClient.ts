import { MutationCache, QueryClient } from '@tanstack/react-query';
import { OFFLINE_CHANGE, isOfflineError } from '../lib/offline';
import { KEEP_FOR_MS } from '../lib/offlineCopy';
import { showToast } from './ui/toast';

/**
 * The app's data client. Offline (owner, 30 Oct 2026): a change runs at once and fails with
 * "You're offline. Nothing was changed." instead of being held and sent later, which is what the
 * data library does by default. A change can name its own words in `meta.offlineMessage`.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      // Pages seen earlier in this visit stay in memory, so their offline copy stays too.
      queries: { gcTime: KEEP_FOR_MS },
      mutations: { networkMode: 'always' },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!isOfflineError(error)) return;
        const words = mutation.meta?.offlineMessage;
        showToast(typeof words === 'string' ? words : OFFLINE_CHANGE, { offline: true });
      },
    }),
  });
}
