import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../api/client';
import { Button } from '../components/ui/button';
import { z } from 'zod';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Info, RotateCcw } from 'lucide-react';
import { getGmailConversationUrl } from '../utils/gmail';

const gmailSearchSchema = z.object({
  gmailError: z.string().optional(),
});

import { Pagination } from '../components/ui/pagination';

import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip';

export const Route = createFileRoute('/gmail')({
  validateSearch: gmailSearchSchema,
  component: GmailPage,
});

function GmailPage() {
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/gmail' });
  const lastSync = useRef<string | null>(null);
  const [offset, setOffset] = useState(0);
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
    queryFn: () => api.getGmailStatus(),
    refetchInterval: query => query.state.data?.syncStatus === 'SYNCING' ? 2000 : false,
  });

  const { data: messagesData, isLoading: isLoadingMessages, error: messagesError } = useQuery({
    queryKey: ['gmailMessages', { offset, limit }],
    queryFn: () => api.getMessages({ offset, limit }),
    refetchInterval: query => {
      const items = query.state.data?.items || [];
      const hasActive = items.some(m => m.processingState === 'PENDING' || (m.processingState === 'PROCESSING' && !m.processingRetryable));
      if (hasActive) return 2000;
      const hasRetrying = items.some(m => m.processingState === 'PROCESSING' && m.processingRetryable);
      if (hasRetrying) return 15000;
      return false;
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

  const syncMutation = useMutation({
    mutationFn: () => api.triggerSync(),
    onSuccess: () => { setOffset(0); },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailStatus'] });
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
    }
  });

  const retryMutation = useMutation({
    mutationFn: (emailId: string) => api.retryEmail(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
    }
  });

  useEffect(() => {
    const completed = statusData?.lastSyncedAt ? String(statusData.lastSyncedAt) : null;
    if (completed && completed !== lastSync.current) {
      lastSync.current = completed;
      for (const key of ['gmailMessages', 'applications', 'application', 'application-events', 'application-actions', 'actions', 'unmatched-emails', 'ambiguous-emails']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    }
  }, [statusData?.lastSyncedAt, queryClient]);

  const handleConnect = () => {
    window.location.href = '/api/gmail/connect';
  };

  return (
    <TooltipProvider>
      <div className="max-w-6xl mx-auto space-y-8 px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Gmail Integration</h2>
      </div>

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
                Control how far back to look for emails during sync.
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
          <h3 className="text-lg font-medium">Ingested Emails</h3>
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
              No emails synced yet. Click 'Sync Now' to begin.
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
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${msg.processingState === 'FAILED' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-secondary text-secondary-foreground'}`}>
                              {msg.processingState || 'PENDING'}
                            </span>
                            {msg.processingErrorDetails && (
                              <Tooltip>
                                <TooltipTrigger className="text-muted-foreground hover:text-foreground cursor-help transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full">
                                  <Info className="h-4 w-4 text-destructive" />
                                </TooltipTrigger>
                                <TooltipContent className="p-0 overflow-hidden">
                                  <div className={`px-3 py-2 border-b ${msg.processingRetryable ? 'bg-status-warning-subtle border-status-warning/20' : 'bg-status-error-subtle border-status-error/20'}`}>
                                    <div className={`font-semibold text-[13px] flex items-center gap-2 ${msg.processingRetryable ? 'text-status-warning' : 'text-status-error'}`}>
                                      {msg.processingRetryable ? 'Retrying (Rate Limited)' : 'Processing Error'}
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
                                    <div className="mt-2 pt-2 border-t border-border flex justify-end">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-7 text-xs px-2 cursor-pointer"
                                        disabled={retryMutation.isPending}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          retryMutation.mutate(msg.id);
                                        }}
                                      >
                                        <RotateCcw className={`mr-1.5 h-3 w-3 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                                        Manual Retry
                                      </Button>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
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
