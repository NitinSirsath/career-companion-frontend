import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '../../api/client';
import { useSyncSandbox } from '../../api/sandbox';
import { sandboxProblem, syncLine } from '../../lib/sandbox';
import { PlainRow, PlainSection } from '../phone/PlainList';
import { Button } from '../ui/button';
import { ResetSandboxDialog } from './ResetSandboxDialog';

/** The Gmail connection (the sandbox stands in for it), and the sync. */
function useSandboxSync() {
  const { data: gmail } = useQuery({
    queryKey: ['gmailStatus'],
    queryFn: ({ signal }) => api.getGmailStatus({ signal }),
    refetchInterval: (query) => (query.state.data?.syncStatus === 'SYNCING' ? 2000 : false),
  });
  const sync = useSyncSandbox();
  const syncing = sync.isPending || gmail?.syncStatus === 'SYNCING';
  const notConnected = !!gmail && !gmail.connected;
  return { gmail, sync, syncing, notConnected, problem: notConnected || sync.isError };
}

type SandboxSync = ReturnType<typeof useSandboxSync>;

/** Not connected yet, or the sync did not start. */
function SyncProblems({ state }: { state: SandboxSync }) {
  return (
    <>
      {state.notConnected && (
        <p role="alert" className="text-sm text-status-warning">
          The sandbox mailbox is not connected yet.{' '}
          <Link to="/gmail" className="font-medium underline">
            Connect it on the Gmail Sync page
          </Link>
          , then sync.
        </p>
      )}
      {state.sync.isError && (
        <p role="alert" className="text-sm text-status-error">
          {sandboxProblem(state.sync.error)}
        </p>
      )}
    </>
  );
}

/** Phones: Sync now as the page's one blue row, with when it last synced under it. */
function PhoneSyncRow({ state, notSynced }: { state: SandboxSync; notSynced: number }) {
  const { gmail, sync, syncing } = state;
  return (
    <PlainSection note={state.problem ? <SyncProblems state={state} /> : undefined}>
      <PlainRow
        tone="blue"
        onClick={syncing || !gmail?.connected ? undefined : () => sync.mutate()}
        detail={gmail?.connected ? syncLine(gmail.lastSyncedAt, notSynced) : undefined}
      >
        {syncing ? 'Syncing…' : 'Sync now'}
      </PlainRow>
    </PlainSection>
  );
}

/**
 * When the app last synced, how much sandbox mail it has not seen yet, and the sync itself: the
 * same sync as on the Gmail Sync page. A sandbox mail reaches the app only through it.
 */
export function SandboxSyncBar({
  notSynced,
  phone = false,
}: {
  notSynced: number;
  phone?: boolean;
}) {
  const state = useSandboxSync();
  const { gmail, sync, syncing } = state;
  if (phone) return <PhoneSyncRow state={state} notSynced={notSynced} />;
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
      <SyncProblems state={state} />
    </div>
  );
}
