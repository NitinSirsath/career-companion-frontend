import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { DailyWorkspace } from '../components/DailyWorkspace';
import { api } from '../api/client';
import { ApplicationResponse } from '../contracts/application';
import { Button } from '../components/ui/button';

import { Pagination } from '../components/ui/pagination';
import { GmailLink } from '../components/ui/GmailLink';
import { fetchApplicationsPage } from '../lib/applicationCache';
import { AnalyzedBy } from '../components/ai/AnalyzedBy';
import { PendingSubmissionsSection } from '../components/automation/PendingSubmissionsSection';

export const Route = createFileRoute('/')({
  errorComponent: RouteErrorPage,
  component: DashboardPage,
});

function AmbiguousMatchesSection({ applications }: { applications: ApplicationResponse[] }) {
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

function UnmatchedEmailsSection({ applications }: { applications: ApplicationResponse[] }) {
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

function DashboardPage() {
  const queryClient = useQueryClient();
  const [applicationOffset, setApplicationOffset] = useState(0);
  const {
    data: applicationsResponse,
    error: applicationError,
    isFetching,
  } = useQuery({
    queryKey: ['applications', { offset: applicationOffset, limit: 20 }],
    // Same cache key as the applications page, so use the same revision-guarded fetch.
    queryFn: ({ signal }) =>
      fetchApplicationsPage(queryClient, { offset: applicationOffset, limit: 20 }, signal),
    placeholderData: keepPreviousData,
  });
  const applications = applicationsResponse?.items;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Here is what needs your attention.</p>
      </div>

      <AIAccessNotice />
      <DailyWorkspace />

      {applicationError && (
        <p role="alert">Could not load applications: {applicationError.message}</p>
      )}
      {(applicationOffset > 0 || applicationsResponse?.metadata.nextOffset != null) && (
        <section aria-label="Applications for matching">
          <p className="text-sm">Browse applications available in the matching lists below.</p>
          <Pagination
            offset={applicationOffset}
            limit={20}
            hasNext={!isFetching && applicationsResponse?.metadata.nextOffset != null}
            onPrevious={() => setApplicationOffset(Math.max(0, applicationOffset - 20))}
            onNext={() =>
              applicationsResponse?.metadata.nextOffset != null &&
              setApplicationOffset(applicationsResponse.metadata.nextOffset)
            }
          />
        </section>
      )}
      {applications && (
        <div className="space-y-10">
          <div id="submission-review" tabIndex={-1}>
            <PendingSubmissionsSection applications={applications} />
          </div>
          <div id="unmatched-review" tabIndex={-1}>
            <UnmatchedEmailsSection applications={applications} />
          </div>
          <div id="ambiguous-review" tabIndex={-1}>
            <AmbiguousMatchesSection applications={applications} />
          </div>
        </div>
      )}
    </div>
  );
}
// Fix contract boundary mismatch
