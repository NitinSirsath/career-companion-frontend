import { Renew } from '@carbon/icons-react';
import { useGmailStatus, useSyncNow } from '../../api/gmail';
import { mailDateTime } from '../../lib/mails';
import { Button } from '../ui/button';

/** "Synced Today, 10:00 PM · Sync now": when mail last came in, and the way to fetch it now. */
export function SyncLine() {
  const { data } = useGmailStatus();
  const sync = useSyncNow();
  if (!data?.connected) return null;
  const syncing = sync.isPending || data.syncStatus === 'SYNCING';
  const last = typeof data.lastSyncedAt === 'string' ? data.lastSyncedAt : null;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-xs text-text-secondary">
        {last ? `Synced ${mailDateTime(last)}` : 'Not synced yet'}
      </span>
      <Button variant="secondary" loading={syncing} onClick={() => sync.mutate()}>
        {!syncing && <Renew size={16} aria-hidden="true" />}
        {syncing ? 'Syncing…' : 'Sync now'}
      </Button>
    </div>
  );
}
