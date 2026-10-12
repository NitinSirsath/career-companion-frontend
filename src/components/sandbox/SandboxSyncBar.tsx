import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '../../api/client';
import { useSyncSandbox } from '../../api/sandbox';
import { sandboxProblem, syncLine } from '../../lib/sandbox';
import { Button } from '../ui/button';
import { ResetSandboxDialog } from './ResetSandboxDialog';

/**
 * When the app last synced, how much sandbox mail it has not seen yet, and the sync itself: the
 * same sync as on the Gmail Sync page. A sandbox mail reaches the app only through it.
 */
export function SandboxSyncBar({ notSynced }: { notSynced: number }) {
  const { data: gmail } = useQuery({
    queryKey: ['gmailStatus'],
    queryFn: ({ signal }) => api.getGmailStatus({ signal }),
    refetchInterval: (query) => (query.state.data?.syncStatus === 'SYNCING' ? 2000 : false),
  });
  const sync = useSyncSandbox();
  const syncing = sync.isPending || gmail?.syncStatus === 'SYNCING';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {gmail?.connected && (
          <span className="text-sm text-text-secondary">
            {syncLine(gmail.lastSyncedAt, notSynced)}
          </span>
        )}
        <Button disabled={syncing || !gmail?.connected} onClick={() => sync.mutate()}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
        <ResetSandboxDialog />
      </div>
      {gmail && !gmail.connected && (
        <p role="alert" className="text-sm text-status-warning">
          The sandbox mailbox is not connected yet.{' '}
          <Link to="/gmail" className="font-medium underline">
            Connect it on the Gmail Sync page
          </Link>
          , then sync.
        </p>
      )}
      {sync.isError && (
        <p role="alert" className="text-sm text-status-error">
          {sandboxProblem(sync.error)}
        </p>
      )}
    </div>
  );
}
