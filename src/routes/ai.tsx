import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Add } from '@carbon/icons-react';
import { api } from '../api/client';
import { useGmailStatus } from '../api/gmail';
import type { ProviderActions } from '../components/ai/ActiveProviderCard';
import {
  OpenProviderDialog,
  ProvidersBody,
  type OpenDialog,
} from '../components/ai/ProvidersPageParts';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { InlineNotification } from '../components/ui/notification';
import { SectionError } from '../components/ui/section-error';
import { SkeletonList } from '../components/ui/skeleton';
import { canConnectMore } from '../lib/aiConnections';

export const Route = createFileRoute('/ai')({
  errorComponent: RouteErrorPage,
  component: AIProvidersPage,
});

/**
 * AI providers: NorthList's second account, next to the Gmail connection. Several can be
 * connected; the active one reads the mail.
 */
function AIProvidersPage() {
  const [open, setOpen] = useState<OpenDialog>(null);
  const [note, setNote] = useState<string | null>(null);
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  const openDialog = (next: Exclude<OpenDialog, null>) => {
    setNote(null);
    setOpen(next);
  };
  const { data: gmail } = useGmailStatus();
  const actions: ProviderActions = {
    onReplaceKey: (provider) => openDialog({ kind: 'replace', provider }),
    onRemove: (provider) => openDialog({ kind: 'remove', provider }),
    onActivate: (provider) => openDialog({ kind: 'activate', provider }),
    onUseFreeAI: () => openDialog({ kind: 'free', backup: false }),
    onAddFreeAI: () => openDialog({ kind: 'free', backup: true }),
    onNote: setNote,
  };
  const connect = () => openDialog({ kind: 'connect', start: null });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="AI providers"
        description="NorthList reads your job mails with AI: your own AI account, or the free AI. You can connect several providers. One is active and reads your mail."
        actions={
          settings &&
          canConnectMore(settings) && (
            <Button onClick={connect}>
              <Add size={16} aria-hidden="true" />
              Connect a provider
            </Button>
          )
        }
      />
      {isLoading && <SkeletonList rows={3} label="Loading AI settings" />}
      {error && <SectionError title="Could not load your AI settings" />}
      {note && <InlineNotification kind="success">{note}</InlineNotification>}
      {settings && (
        <ProvidersBody
          settings={settings}
          actions={actions}
          gmailConnected={!!gmail?.connected}
          onConnect={connect}
          onConnectFirst={(provider) => openDialog({ kind: 'connect', start: provider })}
        />
      )}
      {settings && open && (
        <OpenProviderDialog
          open={open}
          settings={settings}
          onClose={() => setOpen(null)}
          onDone={(text) => {
            setNote(text);
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}
