import { useSyncExternalStore, type ReactNode } from 'react';
import { WifiOff } from '@carbon/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { pageHasNoCopy, shownSince, shownSinceText, useOnline } from '../../lib/offline';
import { Button } from '../ui/button';

/**
 * What the page shows now: whether it has a copy offline, and since when its data is. A page has
 * no copy when one of its own parts has no data, or when it shows no data at all.
 */
function usePageCopy() {
  const cache = useQueryClient().getQueryCache();
  const subscribe = (listener: () => void) => cache.subscribe(listener);
  const active = () => cache.findAll({ type: 'active' });
  const noCopy = useSyncExternalStore(subscribe, () => pageHasNoCopy(active()));
  const since = useSyncExternalStore(subscribe, () => shownSince(active()));
  return { missing: noCopy || since === null, since };
}

/** Offline (owner, 30 Oct 2026): a grey line under the top bar says so, and since when. */
export function OfflineLine() {
  const online = useOnline();
  const { missing, since } = usePageCopy();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b border-border-subtle bg-surface-subtle px-4 py-2 text-[13px] leading-[18px] md:px-12"
    >
      <WifiOff size={16} aria-hidden="true" className="mt-px shrink-0" />
      <span>
        You're offline.
        {!missing && since !== null && (
          <span className="text-text-secondary"> {shownSinceText(since)}</span>
        )}
      </span>
    </div>
  );
}

/**
 * Offline, a page with no copy on this device says so instead of loading forever. The page stays
 * mounted (hidden) under the message, so it keeps its state and shows once its data comes.
 */
export function OfflinePage({ children }: { children: ReactNode }) {
  const online = useOnline();
  const { missing } = usePageCopy();
  const queryClient = useQueryClient();
  const noCopy = !online && missing;
  return (
    <>
      <div hidden={noCopy}>{children}</div>
      {noCopy && (
        <div className="flex animate-fade-in flex-col items-center gap-2 py-16 text-center">
          <WifiOff size={32} aria-hidden="true" />
          <p className="text-base font-semibold">No copy of this page yet</p>
          <p className="max-w-95 text-sm text-text-secondary">
            There is no copy of this page on this device. It opens when you're back online.
          </p>
          <Button
            variant="tertiary"
            className="mt-2"
            onClick={() => void queryClient.refetchQueries({ type: 'active' })}
          >
            Try again
          </Button>
        </div>
      )}
    </>
  );
}
