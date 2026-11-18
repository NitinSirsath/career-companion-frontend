import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useFreeAIWithGmail } from '../../api/freeAI';
import type { GmailStatusResponse } from '../../contracts/gmail';
import { startGmailConnect } from '../../lib/afterGmailConnect';
import { gmailConnectionCopy } from '../../lib/gmailConnection';
import { FreeAIConsentLine } from '../ai/FreeAIConsentLine';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { InlineNotification } from '../ui/notification';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { GmailLookback } from './GmailSyncSettings';

/** "Disconnect Gmail?": it asks first, since connecting again goes through Google. */
export function DisconnectDialog({
  open,
  onOpenChange,
  onDisconnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnected?: () => void;
}) {
  const queryClient = useQueryClient();
  const disconnect = useMutation({
    mutationFn: () => api.disconnectGmail(),
    onSuccess: () => {
      onOpenChange(false);
      onDisconnected?.();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['gmailStatus'] });
      void queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
    },
  });
  return (
    <Dialog open={open} onOpenChange={(value) => !disconnect.isPending && onOpenChange(value)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disconnect Gmail?</DialogTitle>
          <DialogDescription>
            The app stops reading your mail and gives up its access to your Gmail. Your applications
            and the mails it already read stay. You can connect the same account again later.
          </DialogDescription>
        </DialogHeader>
        {disconnect.isError && (
          <InlineNotification kind="error">Gmail did not disconnect. Try again.</InlineNotification>
        )}
        <DialogFooter>
          <Button
            variant="secondary"
            disabled={disconnect.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Disconnecting stops the reading; it asks first. */
function DisconnectButton({ onDisconnected }: { onDisconnected?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="danger-ghost" size="sm" onClick={() => setOpen(true)}>
        Disconnect
      </Button>
      <DisconnectDialog open={open} onOpenChange={setOpen} onDisconnected={onDisconnected} />
    </>
  );
}

/**
 * Which Gmail account the app reads, and how far back: one strip at the top of the page, with the
 * account on the left and the look-back choice on the right (stacked on phones).
 */
export function GmailConnection({
  status,
  loading,
  failed,
  devMode,
  onDisconnected,
}: {
  status: GmailStatusResponse | undefined;
  loading: boolean;
  failed: boolean;
  devMode: boolean;
  onDisconnected?: () => void;
}) {
  const copy = gmailConnectionCopy(devMode, status?.status);
  const withFreeAI = useFreeAIWithGmail();
  if (loading) return <SkeletonList rows={1} label="Loading the Gmail connection" />;
  if (failed) return <SectionError title="Could not load the Gmail connection" />;
  if (!status?.connected)
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 panel px-6 py-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm">{copy.notConnected}</p>
          {withFreeAI && <FreeAIConsentLine />}
        </div>
        <Button onClick={() => startGmailConnect(withFreeAI)}>{copy.connect}</Button>
      </div>
    );
  return (
    <div className="grid panel md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-2 px-6 py-4">
        <span className="text-xs text-text-secondary">Account</span>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2.5 text-sm">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-ok" />
            <span className="min-w-0 break-words">
              Connected as <strong className="font-semibold">{status.gmailEmail}</strong>
              {copy.connectedNote && (
                <span className="block text-xs text-text-secondary">{copy.connectedNote}</span>
              )}
            </span>
          </p>
          <DisconnectButton onDisconnected={onDisconnected} />
        </div>
      </div>
      <div className="min-w-0 border-border-subtle px-6 py-4 max-md:border-t md:border-l">
        <GmailLookback status={status} />
      </div>
    </div>
  );
}
