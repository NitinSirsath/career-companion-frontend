import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../api/client';
import { Button } from '../components/ui/button';
import { z } from 'zod';
import { useEffect, useRef, useState } from 'react';

const gmailSearchSchema = z.object({
  gmailError: z.string().optional(),
});

import { Pagination } from '../components/ui/pagination';

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
    refetchInterval: query => query.state.data?.items.some(message => message.processingState === 'PENDING' || message.processingState === 'PROCESSING') ? 2000 : false,
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
    <div className="max-w-4xl mx-auto space-y-8">
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
                      <th className="px-4 py-3 font-medium">Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {messagesData.items.map((msg) => (
                      <tr key={msg.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium max-w-xs truncate" title={msg.subject || ''}>
                          {msg.subject || '(No Subject)'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={msg.sender || ''}>
                          {msg.sender || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">
                            {msg.processingState && msg.processingState !== 'COMPLETED' ? msg.processingState : msg.relevanceState}
                          </span>
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
  );
}
