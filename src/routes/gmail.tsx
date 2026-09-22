import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../api/client';
import { Button } from '../components/ui/button';
import { z } from 'zod';
import { useEffect, useState } from 'react';

const gmailSearchSchema = z.object({
  gmailError: z.string().optional(),
});

export const Route = createFileRoute('/gmail')({
  validateSearch: gmailSearchSchema,
  component: GmailPage,
});

function GmailPage() {
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: '/gmail' });
  const [syncResult, setSyncResult] = useState<{ ingested: number; skipped: number } | null>(null);
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
  });

  const { data: messagesData, isLoading: isLoadingMessages, error: messagesError } = useQuery({
    queryKey: ['gmailMessages'],
    queryFn: () => api.getMessages(),
    enabled: !!statusData?.connected, // Only fetch if connected
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectGmail(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailStatus'] });
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
      setSyncResult(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => api.triggerSync(),
    onSuccess: (data) => {
      setSyncResult({ ingested: data.messagesIngested, skipped: data.messagesSkipped });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gmailStatus'] });
      queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
    }
  });

  const handleConnect = () => {
    window.location.href = '/api/gmail/connect';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Gmail Integration</h2>
      </div>

      {showError && (
        <div className="p-4 text-sm font-medium text-destructive bg-destructive/10 border border-destructive/20 rounded-xl mb-4">
          Gmail access was not granted. You can connect Gmail at any time.
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
              
              {syncResult && (
                <p className="text-sm font-medium mt-2 text-status-success">
                  Synced {syncResult.ingested} messages (skipped {syncResult.skipped})
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
                {syncMutation.isPending || statusData.syncStatus === 'SYNCING' ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ingested Email List */}
      {(statusData?.connected || (messagesData && messagesData.total > 0)) && (
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
          ) : !messagesData?.messages.length ? (
            <div className="p-12 text-center text-muted-foreground border rounded-xl border-dashed">
              No emails synced yet. Click 'Sync Now' to begin.
            </div>
          ) : (
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
                    {messagesData.messages.map((msg) => (
                      <tr key={msg.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 font-medium max-w-xs truncate" title={msg.subject || ''}>
                          {msg.subject || '(No Subject)'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" title={msg.sender || ''}>
                          {msg.sender || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">
                            {msg.relevanceState}
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
          )}
        </div>
      )}
    </div>
  );
}
