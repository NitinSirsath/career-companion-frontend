import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { useDevMode } from '../api/appMode';
import { useGmailStatus } from '../api/gmail';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { GmailConnection } from '../components/gmail/GmailConnection';
import { GmailLookback, GmailSync } from '../components/gmail/GmailSyncSettings';
import { ProcessedMails } from '../components/gmail/ProcessedMails';
import { PageHeader } from '../components/layout/PageHeader';
import { InlineNotification } from '../components/ui/notification';
import { TooltipProvider } from '../components/ui/tooltip';

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

function GmailPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/gmail' });
  const devMode = useDevMode();
  const [offset, setOffset] = useState(0);
  // Google sends the user back with the problem in the URL; it shows once, then the URL is clean.
  const [connectError] = useState(() => search.gmailError ?? null);
  useEffect(() => {
    if (search.gmailError) void navigate({ search: {}, replace: true });
  }, [search.gmailError, navigate]);
  const { data: status, isLoading, error } = useGmailStatus();
  const connected = !!status?.connected;

  return (
    <TooltipProvider>
      <div className="flex flex-col">
        <PageHeader
          title="Gmail sync"
          description="Connect Gmail, and choose how far back the app reads your mail."
        />
        <div className="flex flex-col gap-4 pb-8 empty:hidden">
          <AIAccessNotice />
          {(connectError || search.gmailError) && (
            <ConnectProblem error={connectError ?? search.gmailError ?? ''} />
          )}
        </div>
        <GmailConnection
          status={status}
          loading={isLoading}
          failed={!!error}
          devMode={devMode}
          onDisconnected={() => setOffset(0)}
        />
        {status && connected && (
          <>
            <GmailSync status={status} onAccepted={() => setOffset(0)} />
            <GmailLookback status={status} />
            <ProcessedMails devMode={devMode} offset={offset} onOffset={setOffset} />
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
