import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { GmailStatusResponse } from '../../contracts/gmail';
import { gmailConnectionCopy } from '../../lib/gmailConnection';
import { SettingsSection } from '../layout/SettingsSection';
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

/** Disconnecting stops the reading; it asks first, since connecting again goes through Google. */
function DisconnectButton({ onDisconnected }: { onDisconnected: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const disconnect = useMutation({
    mutationFn: () => api.disconnectGmail(),
    onSuccess: () => {
      setOpen(false);
      onDisconnected();
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['gmailStatus'] });
      void queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
    },
  });
  return (
    <>
      <Button variant="danger-ghost" onClick={() => setOpen(true)}>
        Disconnect
      </Button>
      <Dialog open={open} onOpenChange={(value) => !disconnect.isPending && setOpen(value)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Gmail?</DialogTitle>
            <DialogDescription>
              The app stops reading your mail and gives up its access to your Gmail. Your
              applications and the mails it already read stay. You can connect the same account
              again later.
            </DialogDescription>
          </DialogHeader>
          {disconnect.isError && (
            <InlineNotification kind="error">
              Gmail did not disconnect. Try again.
            </InlineNotification>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              disabled={disconnect.isPending}
              onClick={() => setOpen(false)}
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
    </>
  );
}

/** Which Gmail account the app reads, and the way to connect or disconnect it. */
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
  onDisconnected: () => void;
}) {
  const copy = gmailConnectionCopy(devMode, status?.status);
  let body: React.ReactNode;
  if (loading) body = <SkeletonList rows={1} label="Loading the Gmail connection" />;
  else if (failed) body = <SectionError title="Could not load the Gmail connection" />;
  else if (!status?.connected)
    body = (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">{copy.notConnected}</p>
        <Button
          onClick={() => {
            window.location.href = '/api/gmail/connect';
          }}
        >
          {copy.connect}
        </Button>
      </div>
    );
  else
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-ok" />
        <p className="min-w-0 flex-1 text-sm">
          Connected as <strong className="font-semibold">{status.gmailEmail}</strong>
          {copy.connectedNote && (
            <span className="block text-xs text-text-secondary">{copy.connectedNote}</span>
          )}
        </p>
        <DisconnectButton onDisconnected={onDisconnected} />
      </div>
    );
  return (
    <SettingsSection title="Connection" help="The Gmail account the app reads.">
      {body}
    </SettingsSection>
  );
}
