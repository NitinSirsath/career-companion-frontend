import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useSandboxMailbox } from '../api/appMode';
import { api } from '../api/client';
import { useGmailStatus, useSyncNow } from '../api/gmail';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { GmailConnection } from '../components/gmail/GmailConnection';
import { GmailSyncNotices, GmailSyncNow } from '../components/gmail/GmailSyncSettings';
import { EveryMailLink, HowMailIsRead, ReadNumbers } from '../components/gmail/GmailSummary';
import { PageHeader } from '../components/layout/PageHeader';
import { PhoneRefreshCapsule } from '../components/phone/PhoneRefresh';
import { InlineNotification } from '../components/ui/notification';
import { TooltipProvider } from '../components/ui/tooltip';
import { takeGmailConnectStarted } from '../lib/afterGmailConnect';

const gmailSearchSchema = z.object({
  gmailError: z.string().optional(),
});

export const Route = createFileRoute('/gmail')({
  errorComponent: RouteErrorPage,
  validateSearch: gmailSearchSchema,
  component: GmailPage,
});

/** Why connecting Gmail did not work, after Google sent the user back. */
function ConnectProblem({ error }: { error: string }) {
  return (
    <InlineNotification kind="error">
      {error === 'account_change'
        ? 'Connect the same Gmail account again. Connecting a different mailbox is not supported yet.'
        : 'Gmail connection did not complete. Please try again.'}
    </InlineNotification>
  );
}

/**
 * Right after Gmail is connected, a user with no AI provider yet goes on to choose how mails are
 * read (owner, 24 Oct 2026). Since 15 Nov 2026 that happens only when the free AI could not come
 * with the connection; with it, the user goes to the Dashboard instead. Anyone else stays here.
 */
function useNextStepAfterConnect(connected: boolean) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    if (!connected || !takeGmailConnectStarted()) return;
    queryClient
      .fetchQuery({
        queryKey: ['aiSettings'],
        queryFn: ({ signal }) => api.getAISettings({ signal }),
      })
      .then((ai) => {
        if (!ai.connections.length) void navigate({ to: '/ai' });
      })
      .catch(() => undefined);
  }, [connected, queryClient, navigate]);
}

function GmailPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/gmail' });
  const sandbox = useSandboxMailbox();
  // Google sends the user back with the problem in the URL; it shows once, then the URL is clean.
  const [connectError] = useState(() => search.gmailError ?? null);
  useEffect(() => {
    if (search.gmailError) void navigate({ search: {}, replace: true });
  }, [search.gmailError, navigate]);
  const { data: status, isLoading, error } = useGmailStatus();
  const sync = useSyncNow();
  const connected = !!status?.connected;
  useNextStepAfterConnect(connected);

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        {/* Phones: refresh in the top bar also asks Gmail for new mail (owner, 13 Nov 2026). */}
        <PhoneRefreshCapsule also={() => connected && sync.mutate()} />
        <PageHeader
          className="mb-2"
          title="Gmail sync"
          description="Which Gmail the app reads, what it has read, and how."
          actions={status && connected && <GmailSyncNow status={status} sync={sync} />}
        />
        {/* Before Gmail is connected there is nothing for the AI to read yet. */}
        {connected && <AIAccessNotice />}
        {(connectError || search.gmailError) && (
          <ConnectProblem error={connectError ?? search.gmailError ?? ''} />
        )}
        <GmailConnection status={status} loading={isLoading} failed={!!error} devMode={sandbox} />
        {status && connected && (
          <>
            <GmailSyncNotices status={status} sync={sync} />
            <ReadNumbers />
            <EveryMailLink />
            <HowMailIsRead status={status} />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
