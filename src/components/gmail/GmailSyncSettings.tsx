import { CircleCheckIcon, RefreshCwIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useSyncNow } from '../../api/gmail';
import type { GmailStatusResponse } from '../../contracts/gmail';
import { gmailSyncLine } from '../../lib/gmailConnection';
import { LOOKBACK, LOOKBACK_HELP, syncProblem, useLookbackSave } from './useLookback';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Select } from '../ui/select';

const day = (iso: string) => format(new Date(iso), 'EEE d MMM yyyy');

type SyncNow = ReturnType<typeof useSyncNow>;

/** The page header's actions: when the app last read new mail and reads it next, and "Sync now". */
export function GmailSyncNow({ status, sync }: { status: GmailStatusResponse; sync: SyncNow }) {
  const running = sync.isPending || status.syncStatus === 'SYNCING';
  return (
    <>
      <span className="text-xs text-text-secondary">{gmailSyncLine(status)}</span>
      <Button variant="secondary" loading={running} onClick={() => sync.mutate()}>
        {!running && <RefreshCwIcon size={16} aria-hidden="true" />}
        {running ? 'Syncing…' : 'Sync now'}
      </Button>
    </>
  );
}

/** What went wrong with a sync, and mail dates no sync checked. */
export function GmailSyncNotices({ status, sync }: { status: GmailStatusResponse; sync: SyncNow }) {
  return (
    <>
      {status.syncStatus === 'FAILED' && (
        <InlineNotification kind="error">
          The last sync could not finish. Try again, or connect again if Gmail access was removed.
        </InlineNotification>
      )}
      {status.unscannedGap && (
        <InlineNotification kind="warning">
          Mail received between {day(status.unscannedGap.from)} and {day(status.unscannedGap.until)}{' '}
          was not checked. A sync looks back at most 30 days. Check Gmail for job mails from those
          dates.
        </InlineNotification>
      )}
      {sync.isError && (
        <InlineNotification kind="error">{syncProblem(sync.error)}</InlineNotification>
      )}
    </>
  );
}

/** How far back a sync looks, in the page's strip. It says when the choice is saved. */
export function GmailLookback({ status }: { status: GmailStatusResponse }) {
  const { save, value, chosen } = useLookbackSave(status);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <div className="w-56">
          <Select<string>
            label="Look back"
            value={value}
            disabled={save.isPending || status.syncStatus === 'SYNCING'}
            options={LOOKBACK}
            onValueChange={(next) => save.mutate(Number(next))}
          />
        </div>
        <p role="status" className="min-h-6 pb-2 text-xs">
          {save.isSuccess && (
            <span className="inline-flex animate-fade-in items-center gap-1.5 text-ok">
              <CircleCheckIcon size={16} aria-hidden="true" />
              Saved. The next sync looks back {chosen?.label.replace(' (default)', '')}.
            </span>
          )}
          {save.isError && <span className="text-danger-text">Not saved. Try again.</span>}
        </p>
      </div>
      <p className="text-xs text-text-secondary">{LOOKBACK_HELP}</p>
    </div>
  );
}
