import { MatchCorrectionDialog } from '../components/MatchCorrectionDialog';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api, isApiError } from '../api/client';
import type { AIRetryApprovalDetails } from '../contracts/email';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { AnalyzedBy } from '../components/ai/AnalyzedBy';
import { RetryAnywayDialog } from '../components/ai/RetryAnywayDialog';
import { PROCESSING_ERROR_LABELS } from '../lib/aiLabels';
import { Button } from '../components/ui/button';
import { z } from 'zod';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ExternalLink, Info, RotateCcw } from 'lucide-react';
import { getGmailConversationUrl } from '../utils/gmail';
import { startProcessingRefresh, getProcessingRefreshUntil, subscribeProcessingRefresh } from '../lib/processingRefresh';

const gmailSearchSchema = z.object({
  gmailError: z.string().optional(),
});

import { Pagination } from '../components/ui/pagination';

import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';

/** Definitive retry answers get their own message; only uncertain outcomes say "could not be confirmed". */
function retryMessage(err: unknown): string {
  if (!isApiError(err) || err.outcomeUncertain)
    return `Retry could not be confirmed: ${err instanceof Error ? err.message : 'unknown error'} The list will refresh to show the current state.`;
  switch (err.code) {
    case 'AI_ACCESS_UNAVAILABLE':
      return 'Fix AI access on the AI provider page before retrying.';
    case 'AI_OPERATION_REQUIRES_REVIEW':
      return 'This email needs review by Career Companion before it can be retried.';
    case 'RETRY_RECENTLY_QUEUED':
      return 'A retry was queued recently. Give it a few minutes.';
    case 'AI_OPERATION_CHANGED':
      return 'This email changed. The list will refresh.';
    default:
      return err.message;
  }
}

export const Route = createFileRoute('/gmail')({
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

  useEffect(() => {
    if (search.gmailError === 'denied') {
      setShowError(true);
      // Clean up the URL
      navigate({ search: {}, replace: true });
    }
  }, [search.gmailError, navigate]);

  const { data: statusData, isLoading: isLoadingStatus, error: statusError } = useQuery({
    queryKey: ['gmailStatus'],
    queryFn: ({ signal }) => api.getGmailStatus({ signal }),
    refetchInterval: query => query.state.data?.syncStatus === 'SYNCING' ? 2000 : false,
  });

  // Emails can wait as PENDING for the user's AI access; that is not active processing.
  const { data: aiSettings } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  const aiWaiting = !!aiSettings && aiSettings.access.state !== 'READY';
  const [approval, setApproval] = useState<{ emailId: string; details: AIRetryApprovalDetails } | null>(null);

  const { data: messagesData, isLoading: isLoadingMessages, error: messagesError } = useQuery({
    queryKey: ['gmailMessages', { offset, limit, activeTab }],
    queryFn: () => api.getMessages({ offset, limit, relevance: activeTab }),
    refetchInterval: query => {
      const items = query.state.data?.items || [];
      if (Date.now() < refreshUntil && items.some(m => m.processingState === 'PROCESSING' || (m.processingState === 'PENDING' && !aiWaiting))) return 2000;
      return items.some(m => m.processingState === 'PROCESSING' && m.processingStuck === false) ? 15000 : false;
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
    onSuccess: () => { setOffset(0); },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailStatus'] });
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
      startProcessingRefresh();
    }
  });

  const retryMutation = useMutation({
    mutationFn: (emailId: string) => api.retryEmail(emailId),
    retry: false,
    onError: (err, emailId) => {
      // An uncertain earlier AI attempt: ask the user who pays before one more call.
      if (isApiError(err) && err.code === 'AI_RETRY_NEEDS_APPROVAL')
        setApproval({ emailId, details: err.details as AIRetryApprovalDetails });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
      startProcessingRefresh();
    }
  });

  // Sent only after the user confirmed in the dialog; never resent automatically.
  const approveMutation = useMutation({
    mutationFn: (emailId: string) => api.retryEmail(emailId, { acceptPossibleDuplicateCharge: true }),
    retry: false,
    onSuccess: () => setApproval(null),
    onError: (err) => {
      if (isApiError(err) && err.outcomeUncertain) setApproval(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
      startProcessingRefresh();
    },
  });

  const handleConnect = () => {
    window.location.href = '/api/gmail/connect';
  };

  return (
    <TooltipProvider>
      <div className="max-w-6xl mx-auto space-y-8 px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Gmail Integration</h2>
      </div>

      <AIAccessNotice />

      {(showError || search.gmailError) && (
        <div className="p-4 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-xl mb-4">
          {search.gmailError === 'account_change' ? 'Reconnect the same Gmail account. Connecting a different mailbox is not supported yet.' : 'Gmail connection did not complete. Please try again.'}
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
                <p className="text-muted-foreground text-sm">
                  {statusData?.status === 'REVOKED' 
                    ? 'Gmail access was revoked. Please reconnect.' 
                    : 'Gmail not connected'}
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Connected as <span className="font-semibold text-foreground">{statusData.gmailEmail}</span>
                </p>
              )}
            </div>
            
            <div>
              {!statusData?.connected ? (
                <Button onClick={handleConnect}>
                  {statusData?.status === 'REVOKED' ? 'Reconnect Gmail' : 'Connect Gmail'}
                </Button>
              ) : (
                <Button 
                  variant="outline" 
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
              
              {statusData.syncStatus === 'FAILED' && <p role="alert" className="text-destructive">Sync could not finish. Try again, or reconnect if access was revoked.</p>}
              {statusData.lastSyncedAt && <p className="text-sm mt-2">Last synced {format(new Date(statusData.lastSyncedAt), 'MMM d, yyyy h:mm a')}</p>}
              <p className="text-sm mt-2">{statusData.nextScheduledSyncAt
                ? `Next automatic sync: ${format(new Date(statusData.nextScheduledSyncAt), 'MMM d, yyyy h:mm a')}`
                : 'Automatic sync is off.'}</p>
              {statusData.unscannedGap && <p className="text-sm mt-2 text-muted-foreground">
                Mail received between {format(new Date(statusData.unscannedGap.from), 'MMM d, yyyy')} and {format(new Date(statusData.unscannedGap.until), 'MMM d, yyyy')} was not checked. A sync looks back at most 30 days. Check Gmail directly for job emails from those dates.
              </p>}
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
                {syncMutation.isPending || statusData.syncStatus === 'SYNCING' ? 'Syncing...' : 'Sync Now'}
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
                How far back the first sync looks, and how far back a sync looks after you raise this setting. After that, each sync covers everything since the last successful sync, up to 30 days.
              </p>
            </div>
            <div>
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={statusData.syncLookbackDays || 1}
                disabled={syncMutation.isPending || statusData.syncStatus === 'SYNCING'}
                onChange={(e) => {
                  api.updateGmailSettings({ syncLookbackDays: parseInt(e.target.value, 10) })
                    .then(() => queryClient.invalidateQueries({ queryKey: ['gmailStatus'] }));
                }}
              >
                <option value={1}>1 day (Default)</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Ingested Email List */}
      {(statusData?.connected || (messagesData && messagesData?.items?.length > 0)) && (
        <div className="space-y-4">
          <div className="border-b mb-4">
            <div className="flex space-x-6">
              <button
                onClick={() => { setActiveTab('job_related'); setOffset(0); }}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'job_related' 
                    ? 'border-foreground text-foreground' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Job Related
              </button>
              <button
                onClick={() => { setActiveTab('irrelevant'); setOffset(0); }}
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
          {retryMutation.isError && !(isApiError(retryMutation.error) && retryMutation.error.code === 'AI_RETRY_NEEDS_APPROVAL') && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {retryMessage(retryMutation.error)}
            </p>
          )}
          {approveMutation.isError && !approval && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {retryMessage(approveMutation.error)}
            </p>
          )}
          <RetryAnywayDialog
            details={approval?.details ?? null}
            pending={approveMutation.isPending}
            problem={approveMutation.isError && approval ? retryMessage(approveMutation.error) : null}
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
              {activeTab === 'job_related' ? 'No job-related emails found.' : 'No irrelevant emails found.'}
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
                        <td className="px-4 py-3 font-medium max-w-xs truncate" title={msg.subject || ''}>
                          {msg.threadId ? (
                            <a
                              href={getGmailConversationUrl(msg.threadId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 hover:underline text-primary"
                              aria-label={`Open email "${msg.subject || '(No Subject)'}" in Gmail`}
                            >
                              <span className="truncate">{msg.subject || '(No Subject)'}</span>
                              <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                            </a>
                          ) : (
                            <span>{msg.subject || '(No Subject)'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={msg.sender || ''}>
                          {msg.sender || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">
                            {msg.relevanceState}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {msg.application ? <p><Link to="/applications/$id" params={{ id: msg.application.id }} className="text-primary hover:underline">{msg.application.companyName}</Link> <span className="text-xs text-muted-foreground">{msg.matchConfirmedBy === 'USER_CONFIRMED' ? 'you' : 'auto'}</span></p>
                            : msg.matchState === 'IGNORED' ? 'Ignored' : msg.matchState === 'AMBIGUOUS' ? 'Needs review' : msg.relevanceState === 'RELEVANT' ? 'Not linked' : '—'}
                          {(msg.matchState === 'MATCHED' || msg.matchState === 'IGNORED') && <MatchCorrectionDialog emailId={msg.id} matchState={msg.matchState} applicationId={msg.applicationId ?? null} />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${msg.processingStuck ? 'bg-status-warning-subtle text-status-warning border-status-warning/20' : msg.processingState === 'FAILED' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-secondary text-secondary-foreground'}`}>
                              {msg.processingStuck ? 'Stopped' : msg.processingState === 'PROCESSING' && msg.processingRetryable ? 'Retry scheduled' : (msg.processingState ?? 'PENDING') === 'PENDING' && aiWaiting ? 'Waiting for AI' : msg.processingState || 'PENDING'}
                            </span>
                            {msg.processingErrorDetails && (
                              <Tooltip>
                                <TooltipTrigger className="text-muted-foreground hover:text-foreground cursor-help transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
                                  <Info className="h-4 w-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent className="p-0 overflow-hidden">
                                  <div className={`px-3 py-2 border-b ${msg.processingRetryable ? 'bg-status-warning-subtle border-status-warning/20' : 'bg-status-error-subtle border-status-error/20'}`}>
                                    <div className={`font-semibold text-[13px] flex items-center gap-2 ${msg.processingRetryable ? 'text-status-warning' : 'text-status-error'}`}>
                                      {msg.processingStuck ? 'Processing stopped' : msg.processingState === 'PROCESSING' && msg.processingRetryable ? 'Retry scheduled' : (msg.processingErrorCategory && PROCESSING_ERROR_LABELS[msg.processingErrorCategory]) || 'Processing Error'}
                                    </div>
                                  </div>
                                  <div className="p-3 flex flex-col gap-2">
                                    <div className="text-muted-foreground">{msg.processingErrorDetails}</div>
                                    <div className="grid grid-cols-[max-content_1fr] gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground/80">
                                      <span className="font-medium">Stage:</span>
                                      <span>{msg.processingErrorStage || 'unknown'}</span>
                                      {msg.processingFailedAt && (
                                        <>
                                          <span className="font-medium">Failed:</span>
                                          <span>{format(new Date(msg.processingFailedAt), 'MMM d, yyyy h:mm a')}</span>
                                        </>
                                      )}
                                    </div>

                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {msg.processingStuck && <p className="text-sm mt-2 text-muted-foreground">Processing stopped before it finished. Use Manual Retry to continue.</p>}
                          {(msg.processingStuck || msg.processingErrorDetails) && (
                            <Button variant="outline" size="sm" className="mt-2" disabled={retryMutation.isPending || approveMutation.isPending} onClick={() => retryMutation.mutate(msg.id)}>
                              <RotateCcw className="mr-1.5 h-3 w-3" />Manual Retry
                            </Button>
                          )}
                          {msg.processingState === 'COMPLETED' && (
                            <AnalyzedBy provider={msg.aiProcessingResult?.provider} model={msg.aiProcessingResult?.model} />
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {msg.receivedAt ? format(new Date(msg.receivedAt), 'MMM d, yyyy') : '-'}
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
                  onNext={() => messagesData?.metadata?.nextOffset && setOffset(messagesData.metadata.nextOffset)}
                />
              </div>
            )}

        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
