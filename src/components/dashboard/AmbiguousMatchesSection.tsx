import { useState } from 'react';
import { ApplicationPicker } from '../ApplicationPicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApplicationResponse } from '../../contracts/application';
import { Button } from '../ui/button';
import { Pagination } from '../ui/pagination';
import { GmailLink } from '../ui/GmailLink';
import { AnalyzedBy } from '../ai/AnalyzedBy';

/** Part of the old dashboard. Kept in the repo, shown on no page: the Mails page replaces it. */
export function AmbiguousMatchesSection({ applications }: { applications: ApplicationResponse[] }) {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const {
    data: ambiguousEmailsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ambiguous-emails', { offset, limit }],
    queryFn: () => api.getAmbiguousEmails({ offset, limit }),
  });
  const ambiguousEmails = ambiguousEmailsResponse?.items;
  const nextOffset = ambiguousEmailsResponse?.metadata?.nextOffset;
  const resolveMutation = useMutation({
    mutationFn: ({ emailId, applicationId }: { emailId: string; applicationId: string | null }) =>
      api.resolveAmbiguousEmail(emailId, { applicationId }),
    onSuccess: () => {
      setOffset(0);
      for (const key of [
        'workspace',
        'actions',
        'application',
        'application-actions',
        'application-events',
        'gmailMessages',
      ])
        queryClient.invalidateQueries({ queryKey: [key] });
      queryClient.invalidateQueries({ queryKey: ['ambiguous-emails'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  if (error) return <p role="alert">Could not load emails: {error.message}</p>;
  if (isLoading || !ambiguousEmails || (ambiguousEmails.length === 0 && offset === 0)) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-warning">Needs Review</h3>
      {resolveMutation.isError && (
        <p role="alert">Could not resolve email: {resolveMutation.error.message}</p>
      )}
      {ambiguousEmails.length === 0 && <p>No emails on this page.</p>}
      <div className="space-y-3">
        {ambiguousEmails.map((email) => (
          <div
            key={email.id}
            className="border border-border-default border-l-4 border-l-status-warning bg-surface p-4"
          >
            <div className="flex flex-col md:flex-row gap-6 justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-warning">Uncertain Email Match</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs">
                    <span className="font-medium text-muted-foreground">From:</span> {email.sender}
                  </p>
                  {email.subject && (
                    <p className="text-xs">
                      <span className="font-medium text-muted-foreground">Subject:</span>{' '}
                      {email.subject}
                    </p>
                  )}
                  <AnalyzedBy
                    provider={email.aiProcessingResult?.provider}
                    model={email.aiProcessingResult?.model}
                  />
                  {email.threadId && (
                    <div className="pt-1">
                      <GmailLink threadId={email.threadId} subject={email.subject} />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 md:w-[280px]">
                <ApplicationPicker
                  label="Select application to link"
                  hideLabel
                  applications={applications}
                  value=""
                  disabled={resolveMutation.isPending}
                  onChange={(applicationId) => {
                    if (applicationId) resolveMutation.mutate({ emailId: email.id, applicationId });
                  }}
                />
                <Button
                  variant="tertiary"
                  size="sm"
                  className="w-full"
                  disabled={resolveMutation.isPending}
                  onClick={() => resolveMutation.mutate({ emailId: email.id, applicationId: null })}
                >
                  Not related
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(offset > 0 || nextOffset) && (
        <Pagination
          offset={offset}
          limit={limit}
          hasNext={!!nextOffset}
          onPrevious={() => setOffset(Math.max(0, offset - limit))}
          onNext={() => nextOffset && setOffset(nextOffset)}
        />
      )}
    </div>
  );
}
