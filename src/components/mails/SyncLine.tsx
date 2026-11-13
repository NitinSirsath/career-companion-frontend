import { RefreshCwIcon } from 'lucide-react';
import { useGmailStatus, useSyncNow } from '../../api/gmail';
import { mailDateTime } from '../../lib/mails';
import { Button } from '../ui/button';

/**
 * "Synced Today, 10:00 PM · Sync now": when mail last came in, and the way to fetch it now.
 * `look`: `button` beside the page title (laptops); `icon` a small sync button at the end of the
 * phone filter row; `note` only the time, under the phone list.
 */
export function SyncLine({ look = 'button' }: { look?: 'button' | 'icon' | 'note' }) {
  const { data } = useGmailStatus();
  const sync = useSyncNow();
  if (!data?.connected) return null;
  const syncing = sync.isPending || data.syncStatus === 'SYNCING';
  const last = typeof data.lastSyncedAt === 'string' ? data.lastSyncedAt : null;
  const synced = last ? `Synced ${mailDateTime(last)}` : 'Not synced yet';
  const label = syncing ? 'Syncing…' : 'Sync now';
  if (look === 'note') return <p className="py-4 text-xs text-text-tertiary">{synced}</p>;
  if (look === 'icon')
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        title={synced}
        className="text-text-secondary"
        onClick={() => sync.mutate()}
        disabled={syncing}
      >
        <RefreshCwIcon
          size={16}
          aria-hidden="true"
          className={syncing ? 'animate-spin' : undefined}
        />
      </Button>
    );
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
