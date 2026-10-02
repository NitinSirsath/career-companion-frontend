import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api, isApiError } from '../../api/client';
import type { ApplicationResponse } from '../../contracts/application';
import type { PendingSubmission, ResolveSubmissionRequest } from '../../contracts/submission';
import { platformLabel } from '../../lib/eventLabels';
import { safeHttpUrl } from '../../lib/safeUrl';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { NativeSelect } from '../ui/native-select';
import { Pagination } from '../ui/pagination';

const dateTime = (value: string) => format(new Date(value), 'MMM d, yyyy · h:mm a');

/** Every field comes from the user's automation and is untrusted: rendered as plain text only. */
function SubmissionCard({
  submission,
  applications,
  disabled,
  onResolve,
}: {
  submission: PendingSubmission;
  applications: ApplicationResponse[];
  disabled: boolean;
  onResolve: (request: ResolveSubmissionRequest) => void;
}) {
  const [applicationId, setApplicationId] = useState('');
  const jobUrl = safeHttpUrl(submission.jobUrl);
  const where = [platformLabel(submission.platform), submission.destinationHost, submission.location, submission.workMode].filter(Boolean);
  const selectId = `link-${submission.id}`;
  return (
    <article
      aria-label={`Submission: ${submission.company} — ${submission.jobTitle}`}
      className="border border-border-default border-l-4 border-l-status-success bg-surface p-4"
    >
      <div className="flex flex-col md:flex-row gap-6 justify-between">
        <div className="flex-1 min-w-0 space-y-1 break-words">
          <p className="text-sm font-semibold">
            {submission.company} — {submission.jobTitle}
          </p>
          <p className="text-xs text-text-secondary">{where.join(' · ')}</p>
          <p className="text-xs text-text-secondary">
            Submitted <time dateTime={submission.submittedAt}>{dateTime(submission.submittedAt)}</time> · Recorded{' '}
            <time dateTime={submission.receivedAt}>{dateTime(submission.receivedAt)}</time>
          </p>
          {submission.confirmationText && (
            <p className="text-xs">
              <span className="font-medium text-muted-foreground">Confirmation shown:</span>{' '}
              <span className="whitespace-pre-wrap">{submission.confirmationText}</span>
            </p>
          )}
          {jobUrl && (
            <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline text-action-primary">
              Open job posting
            </a>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0 w-full md:w-[280px]">
          <label htmlFor={selectId} className="text-xs font-medium">
            Link to an existing application
          </label>
          <div className="flex gap-2">
            <NativeSelect
              id={selectId}
              className="h-9 py-1"
              value={applicationId}
              disabled={disabled}
              onChange={(e) => setApplicationId(e.target.value)}
            >
              <option value="">Select application…</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.companyName}
                  {app.jobTitle ? ` — ${app.jobTitle}` : ''}
                </option>
              ))}
            </NativeSelect>
            <Button
              size="sm"
              className="h-9"
              disabled={disabled || !applicationId}
              onClick={() => onResolve({ action: 'link', applicationId })}
            >
              Link
            </Button>
          </div>
          <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onResolve({ action: 'create' })}>
            Create application
          </Button>
          <Button size="sm" variant="tertiary" disabled={disabled} onClick={() => onResolve({ action: 'ignore' })}>
            Ignore
          </Button>
        </div>
      </div>
    </article>
  );
}

/**
 * Automation submissions that Career Companion could not match with certainty (ADR-0002 decision 7).
 * Resolution is final. An uncertain outcome refreshes the list and is never resent automatically.
 */
export function PendingSubmissionsSection({ applications }: { applications: ApplicationResponse[] }) {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const limit = 20;
  const { data, isLoading, error } = useQuery({
    queryKey: ['pending-submissions', { offset, limit }],
    queryFn: ({ signal }) => api.getPendingSubmissions({ offset, limit }, { signal }),
  });
  const resolve = useMutation({
    mutationFn: ({ id, request }: { id: string; request: ResolveSubmissionRequest }) => api.resolveSubmission(id, request),
    retry: false, // never replay a resolution automatically
    onMutate: () => setNotice(null),
    onSuccess: () => {
      setOffset(0);
      for (const key of ['applications', 'application', 'application-events'])
        void queryClient.invalidateQueries({ queryKey: [key] });
    },
    onError: (err) => {
      if (isApiError(err) && err.outcomeUncertain)
        setNotice('We could not confirm whether this was saved. The list has been refreshed: check it before trying again.');
      else if (isApiError(err) && err.code === 'BAD_REQUEST')
        setNotice('This submission was already resolved. The list has been refreshed.');
      else setNotice(`Could not resolve the submission: ${err.message}`);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['pending-submissions'] }),
  });

  if (error) return <p role="alert">Could not load automation submissions: {error.message}</p>;
  if (isLoading || !data || (data.items.length === 0 && offset === 0 && !notice)) return null;
  const count = `${data.items.length}${data.metadata.nextOffset != null ? '+' : ''}`;

  return (
    <section aria-labelledby="pending-submissions-heading" className="space-y-4">
      <h3 id="pending-submissions-heading" className="text-lg font-medium flex items-center gap-2">
        Automation submissions to review <Badge variant="secondary">{count}</Badge>
      </h3>
      <p className="text-xs text-text-secondary">
        Your automation reported these applications, but Career Companion could not match them with certainty.
      </p>
      {notice && (
        <p role="alert" className="text-sm">
          {notice}
        </p>
      )}
      {data.items.length === 0 && <p className="text-sm">No submissions on this page.</p>}
      <div className="space-y-3">
        {data.items.map((submission) => (
          <SubmissionCard
            key={submission.id}
            submission={submission}
            applications={applications}
            disabled={resolve.isPending}
            onResolve={(request) => resolve.mutate({ id: submission.id, request })}
          />
        ))}
      </div>
      {(offset > 0 || data.metadata.nextOffset != null) && (
        <Pagination
          offset={offset}
          limit={limit}
          hasNext={data.metadata.nextOffset != null}
          onPrevious={() => setOffset(Math.max(0, offset - limit))}
          onNext={() => data.metadata.nextOffset != null && setOffset(data.metadata.nextOffset)}
        />
      )}
    </section>
  );
}
