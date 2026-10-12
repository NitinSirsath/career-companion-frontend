import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { ApplicationResponse } from '../../contracts/application';
import { Pagination } from '../ui/pagination';
import { GmailLink } from '../ui/GmailLink';
import { AnalyzedBy } from '../ai/AnalyzedBy';

/** Part of the old dashboard. Kept in the repo, shown on no page: the Mails page replaces it. */
export function UnmatchedEmailsSection({ applications }: { applications: ApplicationResponse[] }) {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const {
    data: unmatchedEmailsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['unmatched-emails', { offset, limit }],
    queryFn: () => api.getUnmatchedEmails({ offset, limit }),
  });
  const unmatchedEmails = unmatchedEmailsResponse?.items;
  const nextOffset = unmatchedEmailsResponse?.metadata?.nextOffset;
  const resolveMutation = useMutation({
    mutationFn: ({ emailId, applicationId }: { emailId: string; applicationId: string }) =>
      api.resolveUnmatchedEmail(emailId, { applicationId }),
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
      queryClient.invalidateQueries({ queryKey: ['unmatched-emails'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  if (error) return <p role="alert">Could not load emails: {error.message}</p>;
  if (isLoading || !unmatchedEmails || (unmatchedEmails.length === 0 && offset === 0)) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-info">Unmatched Emails</h3>
      {resolveMutation.isError && (
        <p role="alert">Could not link email: {resolveMutation.error.message}</p>
      )}
      {unmatchedEmails.length === 0 && <p>No emails on this page.</p>}
      <div className="space-y-3">
        {unmatchedEmails.map((email) => (
          <div
            key={email.id}
            className="border border-border-default border-l-4 border-l-status-info bg-surface p-4"
          >
            <div className="flex flex-col md:flex-row gap-6 justify-between items-center">
              <div className="flex-1 w-full">
                <div className="space-y-1">
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
              <div className="flex flex-col gap-2 shrink-0 md:w-[280px] w-full mt-2 md:mt-0">
                <select
                  aria-label="Select application to link"
                  className="h-9 w-full rounded-none border border-border-default bg-surface px-3 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
                  onChange={(e) => {
                    if (e.target.value)
                      resolveMutation.mutate({ emailId: email.id, applicationId: e.target.value });
                  }}
                  defaultValue=""
                  disabled={resolveMutation.isPending}
                >
                  <option value="" disabled>
                    Select application...
                  </option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.companyName}
                    </option>
                  ))}
                </select>
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
