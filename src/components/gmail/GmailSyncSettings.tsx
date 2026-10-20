import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckmarkFilled } from '@carbon/icons-react';
import { format } from 'date-fns';
import { api, isApiError } from '../../api/client';
import { useSyncNow } from '../../api/gmail';
import type { GmailStatusResponse } from '../../contracts/gmail';
import { mailDateTime } from '../../lib/mails';
import { FactList, SettingsSection } from '../layout/SettingsSection';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Select } from '../ui/select';

const LOOKBACK = [
  { value: '1', label: '1 day (default)' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
  { value: '30', label: '30 days' },
] as const;

const day = (iso: string) => format(new Date(iso), 'EEE d MMM yyyy');

function syncProblem(error: unknown): string {
  if (isApiError(error) && (error.code === 'SYNC_IN_PROGRESS' || error.status === 409))
    return 'A sync is already running.';
  return 'The sync did not start. Try again in a moment.';
}

/** When the app last read new mail and reads it next; "Sync now" reads it at once. */
export function GmailSync({
  status,
  onAccepted,
}: {
  status: GmailStatusResponse;
  onAccepted: () => void;
}) {
  const sync = useSyncNow(onAccepted);
  const running = sync.isPending || status.syncStatus === 'SYNCING';
  return (
    <SettingsSection
      title="Sync"
      help="The app reads new mail on a schedule. You can also read it now."
    >
      <FactList
        facts={[
          {
            label: 'Last sync',
            value: status.lastSyncedAt ? mailDateTime(String(status.lastSyncedAt)) : 'Not yet',
          },
          {
            label: 'Next sync',
            value: status.nextScheduledSyncAt
              ? mailDateTime(status.nextScheduledSyncAt)
              : 'Automatic sync is off.',
          },
        ]}
      />
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
      <div>
        <Button loading={running} onClick={() => sync.mutate()}>
          {running ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>
    </SettingsSection>
  );
}

/** How far back a sync looks. It says when the choice is saved. */
export function GmailLookback({ status }: { status: GmailStatusResponse }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (days: number) => api.updateGmailSettings({ syncLookbackDays: days }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['gmailStatus'] }),
  });
  const value = String(save.isPending ? save.variables : (status.syncLookbackDays ?? 1));
  const chosen = LOOKBACK.find((option) => option.value === value);
  return (
    <SettingsSection
      title="How far back"
      help="How far back the first sync looks, and how far a sync looks after you raise this. After that, each sync covers everything since the last successful sync, up to 30 days."
    >
      <div className="flex max-w-80 flex-col">
        <Select<string>
          label="Look back"
          value={value}
          disabled={save.isPending || status.syncStatus === 'SYNCING'}
          options={LOOKBACK}
          onValueChange={(next) => save.mutate(Number(next))}
        />
        <p role="status" className="min-h-6 pt-2 text-xs">
          {save.isSuccess && (
            <span className="inline-flex animate-fade-in items-center gap-1.5 text-ok">
              <CheckmarkFilled size={16} aria-hidden="true" />
              Saved. The next sync looks back {chosen?.label.replace(' (default)', '')}.
            </span>
          )}
          {save.isError && <span className="text-danger-text">Not saved. Try again.</span>}
        </p>
      </div>
    </SettingsSection>
  );
}
