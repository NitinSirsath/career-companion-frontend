import { RefreshCwIcon } from 'lucide-react';
import { useGmailStatus, useSyncNow } from '../../api/gmail';
import { mailDateTime } from '../../lib/mails';
import { Button } from '../ui/button';

/**
 * "Synced Today, 10:00 PM · Sync now" beside the Mails title on laptops: when mail last came in,
 * and the way to fetch it now. Phones show the time in the status line under the title, and sync
 * from the refresh in the top bar.
 */
export function SyncLine() {
  const { data } = useGmailStatus();
  const sync = useSyncNow();
  if (!data?.connected) return null;
  const syncing = sync.isPending || data.syncStatus === 'SYNCING';
  const last = typeof data.lastSyncedAt === 'string' ? data.lastSyncedAt : null;
  const synced = last ? `Synced ${mailDateTime(last)}` : 'Not synced yet';
  const label = syncing ? 'Syncing…' : 'Sync now';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs text-text-tertiary">{synced}</span>
      <Button variant="secondary" loading={syncing} onClick={() => sync.mutate()}>
        {!syncing && <RefreshCwIcon size={16} aria-hidden="true" />}
        {label}
      </Button>
    </div>
  );
}
