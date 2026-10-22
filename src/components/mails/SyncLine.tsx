import { Renew } from '@carbon/icons-react';
import { useGmailStatus, useSyncNow } from '../../api/gmail';
import { mailDateTime } from '../../lib/mails';
import { Button } from '../ui/button';

/**
 * "Synced Today, 10:00 PM · Sync now": when mail last came in, and the way to fetch it now.
 * `compact`: one quiet line with a text button, for phones.
 */
export function SyncLine({ compact = false }: { compact?: boolean }) {
  const { data } = useGmailStatus();
  const sync = useSyncNow();
  if (!data?.connected) return null;
  const syncing = sync.isPending || data.syncStatus === 'SYNCING';
  const last = typeof data.lastSyncedAt === 'string' ? data.lastSyncedAt : null;
  const label = syncing ? 'Syncing…' : 'Sync now';
  if (compact)
    return (
      <div className="flex items-center justify-between gap-4 text-xs text-text-secondary">
        <span>{last ? `Synced ${mailDateTime(last)}` : 'Not synced yet'}</span>
        <Button variant="ghost" size="sm" loading={syncing} onClick={() => sync.mutate()}>
          {label}
        </Button>
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-xs text-text-secondary">
        {last ? `Synced ${mailDateTime(last)}` : 'Not synced yet'}
      </span>
      <Button variant="secondary" loading={syncing} onClick={() => sync.mutate()}>
        {!syncing && <Renew size={16} aria-hidden="true" />}
        {label}
      </Button>
    </div>
  );
}
