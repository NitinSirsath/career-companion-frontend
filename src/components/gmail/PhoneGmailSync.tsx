import { useState } from 'react';
import { CheckIcon, MailIcon } from 'lucide-react';
import { useFreeAIWithGmail } from '../../api/freeAI';
import { useSyncNow } from '../../api/gmail';
import type { GmailStatusResponse } from '../../contracts/gmail';
import { startGmailConnect } from '../../lib/afterGmailConnect';
import { gmailConnectionCopy } from '../../lib/gmailConnection';
import { mailDateTime } from '../../lib/mails';
import { FreeAIConsentLine } from '../ai/FreeAIConsentLine';
import { cn } from '../../lib/utils';
import { PLAIN_ROW, PlainRow, PlainSection } from '../phone/PlainList';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { DisconnectDialog } from './GmailConnection';
import { LOOKBACK, LOOKBACK_HELP, useLookbackSave } from './useLookback';

type SyncNow = ReturnType<typeof useSyncNow>;

/** The account, when mail last came in and when it comes next (mock screen 9: facts first). */
function Facts({ status, devMode }: { status: GmailStatusResponse; devMode: boolean }) {
  const note = gmailConnectionCopy(devMode, status.status).connectedNote;
  let last = status.lastSyncedAt ? mailDateTime(String(status.lastSyncedAt)) : 'Not synced yet';
  if (status.syncStatus === 'FAILED') last = 'Failed';
  return (
    <PlainSection>
      <div className={PLAIN_ROW}>
        <MailIcon size={18} aria-hidden="true" className="shrink-0 text-text-secondary" />
        <span className="flex min-w-0 flex-1 flex-col py-2">
          <span className="break-all">{status.gmailEmail}</span>
          <span className="text-phone-sub text-text-secondary">
            {note ? `Connected · ${note}` : 'Connected'}
          </span>
        </span>
      </div>
      <PlainRow value={last}>Last sync</PlainRow>
      <PlainRow
        value={status.nextScheduledSyncAt ? mailDateTime(status.nextScheduledSyncAt) : 'Off'}
      >
        Next sync
      </PlainRow>
    </PlainSection>
  );
}

/** The one blue action: Sync now. */
function SyncNowRow({ status, sync }: { status: GmailStatusResponse; sync: SyncNow }) {
  const running = sync.isPending || status.syncStatus === 'SYNCING';
  return (
    <PlainSection>
      <PlainRow onClick={running ? undefined : () => sync.mutate()} tone="blue">
        {running ? 'Syncing…' : 'Sync now'}
      </PlainRow>
    </PlainSection>
  );
}

/** How far back the first sync reads: four choices, a check on the chosen one. */
function Lookback({ status }: { status: GmailStatusResponse }) {
  const { save, value, chosen } = useLookbackSave(status);
  const busy = save.isPending || status.syncStatus === 'SYNCING';
  let note = LOOKBACK_HELP;
  if (save.isSuccess)
    note = `Saved. The next sync looks back ${chosen?.label.replace(' (default)', '')}.`;
  if (save.isError) note = 'Not saved. Try again.';
  return (
    <PlainSection label="Look back" note={<span role="status">{note}</span>}>
      {LOOKBACK.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={busy}
          onClick={() => value !== option.value && save.mutate(Number(option.value))}
          className={cn(PLAIN_ROW, 'cursor-pointer disabled:cursor-default')}
        >
          <span className="flex-1">{option.label}</span>
          {value === option.value && (
            <CheckIcon size={20} aria-label="Chosen" className="shrink-0 text-link" />
          )}
        </button>
      ))}
    </PlainSection>
  );
}

/** Not connected yet: what is missing, and the blue Connect. */
export function PhoneConnect({
  status,
  devMode,
}: {
  status: GmailStatusResponse | undefined;
  devMode: boolean;
}) {
  const copy = gmailConnectionCopy(devMode, status?.status);
  const withFreeAI = useFreeAIWithGmail();
  return (
    <PlainSection note={withFreeAI && <FreeAIConsentLine />} className="mt-0">
      <PlainRow>{copy.notConnected}</PlainRow>
      <PlainRow onClick={() => startGmailConnect(withFreeAI)} tone="blue">
        {copy.connect}
      </PlainRow>
    </PlainSection>
  );
}

/** The risky action, red and last. */
export function PhoneDisconnect() {
  const [open, setOpen] = useState(false);
  return (
    <PlainSection>
      <PlainRow onClick={() => setOpen(true)} tone="red" center>
        Disconnect Gmail
      </PlainRow>
      <DisconnectDialog open={open} onOpenChange={setOpen} />
    </PlainSection>
  );
}

/**
 * The Gmail connection on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 9): plain
 * rows with the facts, Sync now in blue, the look-back choices with a check. Disconnect comes last,
 * at the bottom of the page.
 */
export function PhoneGmailConnection({
  status,
  loading,
  failed,
  devMode,
  sync,
}: {
  status: GmailStatusResponse | undefined;
  loading: boolean;
  failed: boolean;
  devMode: boolean;
  sync: SyncNow;
}) {
  if (loading) return <SkeletonList rows={2} label="Loading the Gmail connection" />;
  if (failed) return <SectionError title="Could not load the Gmail connection" />;
  if (!status?.connected) return <PhoneConnect status={status} devMode={devMode} />;
  return (
    <div>
      <Facts status={status} devMode={devMode} />
      <SyncNowRow status={status} sync={sync} />
      <Lookback status={status} />
    </div>
  );
}
