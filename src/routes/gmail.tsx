import { MatchCorrectionDialog } from '../components/MatchCorrectionDialog';
import { PageHeader } from '../components/layout/PageHeader';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api, isApiError } from '../api/client';
import type { AIRetryApprovalDetails } from '../contracts/email';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { MailAIStatus } from '../components/ai/MailAIStatus';
import { onlyCareerCompanionText } from '../lib/mailAIStatus';
import { refusedUntil, retryProblem, retryRefusedUntil } from '../lib/retryApproval';
import { RetryAnywayDialog } from '../components/ai/RetryAnywayDialog';
import { Button } from '../components/ui/button';
import { z } from 'zod';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Launch } from '@carbon/icons-react';
import { getGmailConversationUrl } from '../utils/gmail';
import { useDevMode } from '../api/appMode';
import { gmailConnectionCopy } from '../lib/gmailConnection';
import {
  startProcessingRefresh,
  getProcessingRefreshUntil,
  subscribeProcessingRefresh,
} from '../lib/processingRefresh';

const gmailSearchSchema = z.object({
  gmailError: z.string().optional(),
});

import { Pagination } from '../components/ui/pagination';
import { Select } from '../components/ui/select';

import { TooltipProvider } from '../components/ui/tooltip';

/**
 * Definitive retry answers get their own message; only uncertain outcomes say "could not be
 * confirmed". `onlyUs` is the row's own words when only Career Companion may retry the mail.
 */
function retryMessage(err: unknown, onlyUs: string | null): string {
  if (!isApiError(err) || err.outcomeUncertain)
    return `Retry could not be confirmed: ${err instanceof Error ? err.message : 'unknown error'} The list will refresh to show the current state.`;
  switch (err.code) {
    case 'AI_ACCESS_UNAVAILABLE':
      return 'Fix AI access on the AI provider page before retrying.';
    case 'AI_OPERATION_REQUIRES_REVIEW':
      return (
        onlyUs ?? 'Only Career Companion can retry this email. This is our problem, not yours.'
      );
    case 'RETRY_RECENTLY_QUEUED':
      return 'A retry was queued recently. Give it a few minutes.';
    case 'AI_OPERATION_CHANGED':
      return 'This email changed. The list will refresh.';
    default:
      return err.message;
  }
}

export const Route = createFileRoute('/gmail')({
  errorComponent: RouteErrorPage,
  validateSearch: gmailSearchSchema,
  component: GmailPage,
});

function GmailPage() {
  const queryClient = useQueryClient();
  const refreshUntil = useSyncExternalStore(subscribeProcessingRefresh, getProcessingRefreshUntil);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/gmail' });
  const [offset, setOffset] = useState(0);
  const [activeTab, setActiveTab] = useState<'job_related' | 'irrelevant'>('job_related');
  const limit = 20;
  const [showError, setShowError] = useState(false);
  const devMode = useDevMode();

  useEffect(() => {
    if (search.gmailError === 'denied') {
      setShowError(true);
      // Clean up the URL
      navigate({ search: {}, replace: true });
    }
  }, [search.gmailError, navigate]);

  const {
    data: statusData,
    isLoading: isLoadingStatus,
    error: statusError,
  } = useQuery({
    queryKey: ['gmailStatus'],
    queryFn: ({ signal }) => api.getGmailStatus({ signal }),
    refetchInterval: (query) => (query.state.data?.syncStatus === 'SYNCING' ? 2000 : false),
  });

  // Emails can wait as PENDING for the user's AI access; that is not active processing.
  const { data: aiSettings } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  const aiWaiting = !!aiSettings && aiSettings.access.state !== 'READY';
  const pauses = aiSettings?.access.pauses ?? [];
  const [approval, setApproval] = useState<{
    emailId: string;
    details: AIRetryApprovalDetails;
  } | null>(null);
  // A retry the server took: the mail shows as stopped until the worker takes it.
  const [sent, setSent] = useState<string | null>(null);

  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    error: messagesError,
  } = useQuery({
    queryKey: ['gmailMessages', { offset, limit, activeTab }],
    queryFn: () => api.getMessages({ offset, limit, relevance: activeTab }),
    refetchInterval: (query) => {
      const items = query.state.data?.items || [];
      if (
        Date.now() < refreshUntil &&
        items.some(
          (m) =>
            m.processingState === 'PROCESSING' ||
            (m.processingState === 'PENDING' && !aiWaiting) ||
            (m.processingState === 'FAILED' && m.id === sent),
        )
      )
        return 2000;
      return items.some((m) => m.processingState === 'PROCESSING' && m.processingStuck === false)
        ? 15000
        : false;
    },
    enabled: !!statusData?.connected, // Only fetch if connected
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectGmail(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailStatus'] });
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
      setOffset(0);
    },
  });

  // An accepted request, or one whose response was lost/timed out, may still run on the server:
  // reconcile through the shell's bounded refresh instead of relying on the response.
  const syncMutation = useMutation({
    mutationFn: () => api.triggerSync(),
    onSuccess: () => {
      setOffset(0);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailStatus'] });
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
      startProcessingRefresh();
    },
  });

  const retryMutation = useMutation({
    mutationFn: (emailId: string) => api.retryEmail(emailId),
    retry: false,
    onSuccess: (_, emailId) => setSent(emailId),
    onError: (err, emailId) => {
      // An uncertain earlier AI attempt: ask the user who pays before one more call.
      if (isApiError(err) && err.code === 'AI_RETRY_NEEDS_APPROVAL')
        setApproval({ emailId, details: err.details as AIRetryApprovalDetails });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
      startProcessingRefresh();
    },
  });

  // Sent only after the user confirmed in the dialog; never resent automatically.
  const approveMutation = useMutation({
    mutationFn: (emailId: string) =>
      api.retryEmail(emailId, { acceptPossibleDuplicateCharge: true }),
    retry: false,
    onSuccess: (_, emailId) => {
      setApproval(null);
      setSent(emailId);
    },
    // AI cannot be used until a time: the row shows it, so the dialog closes.
    onError: (err) => {
      if (refusedUntil(err) || (isApiError(err) && err.outcomeUncertain)) setApproval(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
      startProcessingRefresh();
    },
  });

  // A retry refused because AI cannot be used right now shows on its row until when.
  const retries = [retryMutation, approveMutation];
  // The sent retry is on its row once the list shows the mail in another state.
  if (messagesData?.items.some((m) => m.id === sent && m.processingState !== 'FAILED'))
    setSent(null);
  // A refused retry in the words of the mail's row, as the list shows it now.
  const onlyUs = (emailId: string | undefined) =>
    onlyCareerCompanionText(messagesData?.items.find((m) => m.id === emailId));

  const handleConnect = () => {
    window.location.href = '/api/gmail/connect';
  };
  const connectionCopy = gmailConnectionCopy(devMode, statusData?.status);

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader
          className="mb-0"
          title="Gmail sync"
          description="Connect Gmail, and choose how far back the app reads your mail."
        />

        <AIAccessNotice />

        {(showError || search.gmailError) && (
          <div className="p-4 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-xl mb-4">
            {search.gmailError === 'account_change'
              ? 'Reconnect the same Gmail account. Connecting a different mailbox is not supported yet.'
              : 'Gmail connection did not complete. Please try again.'}
          </div>
        )}

        {/* Connection Status Card */}
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
          {isLoadingStatus ? (
            <div className="text-muted-foreground">Loading connection status...</div>
          ) : statusError ? (
            <div className="text-destructive font-medium">
              Failed to load status: {statusError.message}
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium mb-1">Connection Status</h3>
                {!statusData?.connected ? (
                  <p className="text-muted-foreground text-sm">{connectionCopy.notConnected}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Connected as{' '}
                    <span className="font-semibold text-foreground">{statusData.gmailEmail}</span>
                    {connectionCopy.connectedNote && ` · ${connectionCopy.connectedNote}`}
                  </p>
                )}
              </div>

              <div>
                {!statusData?.connected ? (
                  <Button onClick={handleConnect}>{connectionCopy.connect}</Button>
                ) : (
                  <Button
                    variant="tertiary"
                    className="text-destructive border-destructive/20 hover:bg-destructive/10"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sync Section (Visible when connected) */}
        {statusData?.connected && (
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium mb-1">Email Sync</h3>
                <p className="text-muted-foreground text-sm">
                  Fetch the latest emails from your Gmail inbox.
                </p>

                {statusData.syncStatus === 'FAILED' && (
                  <p role="alert" className="text-destructive">
                    Sync could not finish. Try again, or reconnect if access was revoked.
                  </p>
                )}
                {statusData.lastSyncedAt && (
                  <p className="text-sm mt-2">
                    Last synced {format(new Date(statusData.lastSyncedAt), 'MMM d, yyyy h:mm a')}
                  </p>
                )}
                <p className="text-sm mt-2">
                  {statusData.nextScheduledSyncAt
                    ? `Next automatic sync: ${format(new Date(statusData.nextScheduledSyncAt), 'MMM d, yyyy h:mm a')}`
                    : 'Automatic sync is off.'}
                </p>
                {statusData.unscannedGap && (
                  <p className="text-sm mt-2 text-muted-foreground">
                    Mail received between{' '}
                    {format(new Date(statusData.unscannedGap.from), 'MMM d, yyyy')} and{' '}
                    {format(new Date(statusData.unscannedGap.until), 'MMM d, yyyy')} was not
                    checked. A sync looks back at most 30 days. Check Gmail directly for job emails
                    from those dates.
                  </p>
                )}
                {syncMutation.isError && (
                  <p className="text-sm font-medium mt-2 text-destructive">
                    Error syncing: {syncMutation.error.message}
                  </p>
                )}
              </div>
              <div>
                <Button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || statusData.syncStatus === 'SYNCING'}
                >
                  {syncMutation.isPending || statusData.syncStatus === 'SYNCING'
                    ? 'Syncing...'
                    : 'Sync Now'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Sync Settings Section */}
        {statusData?.connected && (
          <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-medium mb-1">Sync Settings</h3>
                <p className="text-muted-foreground text-sm">
                  How far back the first sync looks, and how far back a sync looks after you raise
                  this setting. After that, each sync covers everything since the last successful
                  sync, up to 30 days.
                </p>
              </div>
              <Select<string>
                label="Look back"
                className="w-56"
                value={String(statusData.syncLookbackDays || 1)}
                disabled={syncMutation.isPending || statusData.syncStatus === 'SYNCING'}
                options={[
                  { value: '1', label: '1 day (default)' },
                  { value: '7', label: '7 days' },
                  { value: '14', label: '14 days' },
                  { value: '30', label: '30 days' },
                ]}
                onValueChange={(next) => {
                  api
                    .updateGmailSettings({ syncLookbackDays: parseInt(next, 10) })
                    .then(() => queryClient.invalidateQueries({ queryKey: ['gmailStatus'] }));
                }}
              />
            </div>
          </div>
        )}

        {/* Ingested Email List */}
        {(statusData?.connected || (messagesData && messagesData?.items?.length > 0)) && (
          <div className="space-y-4">
            <div className="border-b mb-4">
              <div className="flex space-x-6">
                <button
                  onClick={() => {
                    setActiveTab('job_related');
                    setOffset(0);
                  }}
                  className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'job_related'
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Job Related
                </button>
                <button
                  onClick={() => {
                    setActiveTab('irrelevant');
                    setOffset(0);
                  }}
                  className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'irrelevant'
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Irrelevant
                </button>
              </div>
            </div>
            {retryProblem(retryMutation.error) && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {retryMessage(retryMutation.error, onlyUs(retryMutation.variables))}
              </p>
            )}
            {!approval && retryProblem(approveMutation.error) && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {retryMessage(approveMutation.error, onlyUs(approveMutation.variables))}
              </p>
            )}
            <RetryAnywayDialog
              details={approval?.details ?? null}
              pending={approveMutation.isPending}
              problem={
                approveMutation.isError && approval
                  ? retryMessage(approveMutation.error, onlyUs(approveMutation.variables))
                  : null
              }
              onConfirm={() => approval && approveMutation.mutate(approval.emailId)}
              onCancel={() => {
                setApproval(null);
                approveMutation.reset();
              }}
            />
            {isLoadingMessages ? (
              <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed">
                Loading emails...
              </div>
            ) : messagesError ? (
              <div className="p-8 text-center text-destructive border-destructive/20 border rounded-xl bg-destructive/5">
                Failed to load emails: {messagesError.message}
              </div>
            ) : !messagesData?.items.length ? (
              <div className="p-12 text-center text-muted-foreground border rounded-xl border-dashed">
                {activeTab === 'job_related'
                  ? 'No job-related emails found.'
                  : 'No irrelevant emails found.'}
              </div>
            ) : (
              <>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 font-medium">Subject</th>
                          <th className="px-4 py-3 font-medium">Sender</th>
                          <th className="px-4 py-3 font-medium">State</th>
                          <th className="px-4 py-3 font-medium">Application</th>
                          <th className="px-4 py-3 font-medium">AI Status</th>
                          <th className="px-4 py-3 font-medium">Received</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {messagesData.items.map((msg) => (
                          <tr key={msg.id} className="hover:bg-muted/50 transition-colors">
                            <td
                              className="px-4 py-3 font-medium max-w-xs truncate"
                              title={msg.subject || ''}
                            >
                              {msg.threadId && !devMode ? (
                                <a
                                  href={getGmailConversationUrl(msg.threadId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 hover:underline text-primary"
                                  aria-label={`Open email "${msg.subject || '(No Subject)'}" in Gmail`}
                                >
                                  <span className="truncate">{msg.subject || '(No Subject)'}</span>
                                  <Launch
                                    size={12}
                                    className="flex-shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                </a>
                              ) : (
                                <span>{msg.subject || '(No Subject)'}</span>
                              )}
                            </td>
                            <td
                              className="px-4 py-3 text-muted-foreground max-w-xs truncate"
                              title={msg.sender || ''}
                            >
                              {msg.sender || '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">
                                {msg.relevanceState}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {msg.application ? (
                                <p>
                                  <Link
                                    to="/applications/$id"
                                    params={{ id: msg.application.id }}
                                    className="text-primary hover:underline"
                                  >
                                    {msg.application.companyName}
                                  </Link>{' '}
                                  <span className="text-xs text-muted-foreground">
                                    {msg.matchConfirmedBy === 'USER_CONFIRMED' ? 'you' : 'auto'}
                                  </span>
                                </p>
                              ) : msg.matchState === 'IGNORED' ? (
                                'Ignored'
                              ) : msg.matchState === 'AMBIGUOUS' ? (
                                'Needs review'
                              ) : msg.relevanceState === 'RELEVANT' ? (
                                'Not linked'
                              ) : (
                                '—'
                              )}
                              {(msg.matchState === 'MATCHED' || msg.matchState === 'IGNORED') && (
                                <MatchCorrectionDialog
                                  emailId={msg.id}
                                  matchState={msg.matchState}
                                  applicationId={msg.applicationId ?? null}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <MailAIStatus
                                message={msg}
                                pauses={pauses}
                                refusedUntil={retryRefusedUntil(retries, msg.id)}
                                retryDisabled={retryMutation.isPending || approveMutation.isPending}
                                onRetry={() => retryMutation.mutate(msg.id)}
                              />
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {msg.receivedAt
                                ? format(new Date(msg.receivedAt), 'MMM d, yyyy')
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
            {(offset > 0 || messagesData?.metadata?.nextOffset) && (
              <div className="mt-4">
                <Pagination
                  offset={offset}
                  limit={limit}
                  hasNext={!!messagesData?.metadata?.nextOffset}
                  onPrevious={() => setOffset(Math.max(0, offset - limit))}
                  onNext={() =>
                    messagesData?.metadata?.nextOffset &&
                    setOffset(messagesData.metadata.nextOffset)
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
