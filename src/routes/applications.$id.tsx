import { useState } from 'react';
import { Pagination } from '../components/ui/pagination';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../api/client';
import { ApplicationEventResponse, ApplicationActionResponse } from '../contracts/application';
import { Button } from '../components/ui/button';
import { EffectiveStatus } from '../components/ApplicationStatus';
import { STATUS_LABEL } from '../lib/statusLabels';
import { StatusEditor } from '../components/StatusEditor';
import { applicationQueryOptions } from '../lib/applicationCache';
import { AnalyzedBy } from '../components/ai/AnalyzedBy';
import { AUTOMATION_SUBMITTED, eventLabel, platformLabel } from '../lib/eventLabels';

export const Route = createFileRoute('/applications/$id')({
  component: ApplicationDetailPage,
});

const dateTime = (value: string) => format(new Date(value), 'MMM d, yyyy · h:mm a');

// ─── Timeline dot ─────────────────────────────────────────────────────────────

function TimelineDot({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    EMAIL_PROCESSED: 'bg-status-info',
    [AUTOMATION_SUBMITTED]: 'bg-status-success',
    STATE_INFERRED: 'bg-status-neutral',
    NOTE_ADDED: 'bg-status-neutral',
  };
  const color = colorMap[type] ?? 'bg-muted-foreground';
  return <span className={`mt-1 shrink-0 h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />;
}

// ─── AI state change (AI status only; never the user's effective status) ──────

function AiStateChange({ event }: { event: ApplicationEventResponse }) {
  const { oldState, newState } = event;
  if (!oldState && !newState) return null;
  let text: string;
  if (oldState && newState && oldState === newState) text = `AI status unchanged: ${STATUS_LABEL[newState]}`;
  else if (oldState && newState) text = `AI status: ${STATUS_LABEL[oldState]} → ${STATUS_LABEL[newState]}`;
  else text = `AI status: ${STATUS_LABEL[(newState ?? oldState)!]}`;
  return <p className="text-xs text-text-secondary mt-1">{text}</p>;
}

// ─── Automation submission (reported by the user's tool; never AI, never email) ─

function AutomationSubmission({ event }: { event: ApplicationEventResponse }) {
  const submission = event.sourceSubmission;
  if (!submission) return <p className="text-xs text-text-secondary">Submission details unavailable</p>;
  return (
    <div className="text-xs text-text-secondary break-words space-y-0.5">
      <p>
        Reported by your automation · {platformLabel(submission.platform)}
        {submission.destinationHost && <> · {submission.destinationHost}</>}
      </p>
      <p>
        Submitted <time dateTime={submission.submittedAt}>{dateTime(submission.submittedAt)}</time>
      </p>
      {submission.confirmationText && (
        <p>
          Confirmation shown: <span className="text-text-primary whitespace-pre-wrap">{submission.confirmationText}</span>
        </p>
      )}
    </div>
  );
}

// ─── Timeline event item (rendered as text; React escapes all values) ─────────

function TimelineEventItem({ event }: { event: ApplicationEventResponse }) {
  const source = event.sourceEmail;
  const automation = event.type === AUTOMATION_SUBMITTED;
  return (
    <li className="flex gap-4">
      <div className="flex flex-col items-center">
        <TimelineDot type={event.type} />
      </div>
      <div className="pb-5 flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold">{eventLabel(event.type)}</p>
          <p className="text-xs text-text-secondary whitespace-nowrap">
            Recorded <time dateTime={event.recordedAt}>{dateTime(event.recordedAt)}</time>
          </p>
        </div>
        {automation ? (
          <AutomationSubmission event={event} />
        ) : source ? (
          <div className="text-xs text-text-secondary break-words">
            <p>
              Source email: <span className="text-text-primary">{source.subject || '(No subject)'}</span>
              {source.sender && <> · from {source.sender}</>}
            </p>
            <p>
              {source.receivedAt ? (
                <>Email date <time dateTime={source.receivedAt}>{dateTime(source.receivedAt)}</time></>
              ) : (
                'Email date unknown'
              )}
            </p>
          </div>
        ) : (
          <p className="text-xs text-text-secondary">Source email unavailable</p>
        )}
        {!automation && <AiStateChange event={event} />}
        {!automation && (event.description || event.provenance) && (
          <div className="text-xs text-text-secondary">
            <p className="font-medium">AI interpretation (not verified source text)</p>
            <AnalyzedBy provider={event.analyzedBy?.provider} model={event.analyzedBy?.model} />
            {event.description && <p className="break-words">{event.description}</p>}
            {event.provenance && <p className="italic break-words">{event.provenance}</p>}
          </div>
        )}
      </div>
    </li>
  );
}

// ─── Action item ──────────────────────────────────────────────────────────────

function ActionItem({ action }: { action: ApplicationActionResponse }) {
  const isPending = action.status === 'PENDING';
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ status }: { status: 'COMPLETED' | 'DISMISSED' }) =>
      api.updateAction(action.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-actions', action.applicationId] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['application', action.applicationId] });
      queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
  });

  return (
    <div className={`flex items-start gap-3 p-3 rounded-none border ${isPending ? 'border-border-default border-l-4 border-l-status-warning bg-surface' : 'border-border-default bg-surface-subtle'}`}>
      <span
        className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${isPending ? 'bg-status-warning' : 'bg-muted-foreground'}`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">
          {action.description || action.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-xs font-semibold ${isPending ? 'text-status-warning' : 'text-muted-foreground'}`}>
            {action.status}
          </span>
          {action.deadline && (
            <span className="text-xs text-muted-foreground">
              Due {format(new Date(action.deadline), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>
      {updateMutation.isError && <p role="alert">Could not update action: {updateMutation.error.message}</p>}
      {isPending && (
        <div className="flex gap-2 shrink-0 self-center">
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs px-2"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ status: 'COMPLETED' })}
          >
            Complete
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2 text-muted-foreground"
            disabled={updateMutation.isPending}
            onClick={() => updateMutation.mutate({ status: 'DISMISSED' })}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

function SectionError({ label, message, onRetry }: { label: string; message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="p-4 text-sm text-destructive border border-destructive/20 bg-destructive/5 flex flex-wrap items-center gap-3">
      <span>Failed to load {label}: {message}</span>
      <Button size="sm" variant="tertiary" onClick={onRetry}>Retry</Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ApplicationDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();

  const [eventsOffset, setEventsOffset] = useState(0);
  const [actionsOffset, setActionsOffset] = useState(0);
  const applicationQuery = useQuery(applicationQueryOptions(queryClient, id));
  const eventsQuery = useQuery({
    queryKey: ['application-events', id, eventsOffset],
    queryFn: ({ signal }) => api.getApplicationEvents(id, { offset: eventsOffset }, { signal }),
  });
  const actionsQuery = useQuery({
    queryKey: ['application-actions', id, actionsOffset],
    queryFn: ({ signal }) => api.getApplicationActions(id, { offset: actionsOffset }, { signal }),
  });

  const application = applicationQuery.data;
  const events = eventsQuery.data?.items;
  const actions = actionsQuery.data?.items;
  // Editing needs a currently valid application read; a stale cached copy is shown but not editable.
  const canEdit = !!application && !applicationQuery.isError;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/applications" className="hover:underline hover:text-foreground transition-colors">
          Applications
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">
          {application?.companyName ?? 'Application'}
        </span>
      </div>

      {/* Application */}
      {applicationQuery.isLoading && (
        <div className="p-8 text-center text-muted-foreground border border-dashed" role="status" aria-label="Loading application details">
          Loading application details...
        </div>
      )}
      {applicationQuery.isError && (
        <SectionError
          label={application ? 'the latest application data (showing earlier data)' : 'application data'}
          message={applicationQuery.error.message}
          onRetry={() => void applicationQuery.refetch()}
        />
      )}
      {application && (
        <div className="border border-border bg-card text-card-foreground p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight break-words">{application.companyName}</h2>
              {application.jobTitle && (
                <p className="text-muted-foreground mt-0.5">{application.jobTitle}</p>
              )}
              {application.location && (
                <p className="text-sm text-muted-foreground">{application.location}</p>
              )}
              {application.appliedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Applied {format(new Date(application.appliedAt), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <EffectiveStatus app={application} detailed />
            <StatusEditor key={application.id} application={application} canEdit={canEdit} />
          </div>
        </div>
      )}

      {/* Actions section — independent of history and status editing */}
      <section className="space-y-3" aria-labelledby="actions-heading">
        <h3 id="actions-heading" className="text-lg font-semibold">Actions</h3>
        {actionsQuery.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading actions...</p>}
        {actionsQuery.isError && (
          <SectionError label="actions" message={actionsQuery.error.message} onRetry={() => void actionsQuery.refetch()} />
        )}
        {actions && (
          <>
            <div className="space-y-2">
              {actions.length === 0 && <p className="text-sm text-muted-foreground">{actionsOffset > 0 ? 'No actions on this page.' : 'No actions yet.'}</p>}
              {actions.map((action) => (
                <ActionItem key={action.id} action={action} />
              ))}
            </div>
            {(actionsOffset > 0 || actionsQuery.data?.metadata.nextOffset != null) && (
              <Pagination offset={actionsOffset} limit={20} hasNext={actionsQuery.data?.metadata.nextOffset != null}
                onPrevious={() => setActionsOffset(Math.max(0, actionsOffset - 20))}
                onNext={() => actionsQuery.data?.metadata.nextOffset != null && setActionsOffset(actionsQuery.data.metadata.nextOffset)} />
            )}
          </>
        )}
      </section>

      {/* History section — recording order; independent of status editing */}
      <section className="space-y-3" aria-labelledby="history-heading">
        <h3 id="history-heading" className="text-lg font-semibold">Timeline</h3>
        <p className="text-xs text-text-secondary">
          Listed in the order the app recorded them. Email dates come from the email, and submission times
          from your automation; neither may be when the recruitment event happened.
        </p>
        {eventsQuery.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading history...</p>}
        {eventsQuery.isError && (
          <SectionError label="history" message={eventsQuery.error.message} onRetry={() => void eventsQuery.refetch()} />
        )}
        {events && (events.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground border border-dashed" role="status">
            <p className="text-sm font-medium mb-1">No events yet</p>
            <p className="text-xs">Events appear when emails are processed or your automation reports a submission.</p>
          </div>
        ) : (
          <div className="border border-border bg-card text-card-foreground p-6">
            <div className="relative">
              <div className="absolute left-[5px] top-3 bottom-3 w-px bg-border" aria-hidden="true" />
              <ol className="space-y-0">
                {events.map((event) => (
                  <TimelineEventItem key={event.id} event={event} />
                ))}
              </ol>
            </div>
          </div>
        ))}
        {events && (eventsOffset > 0 || eventsQuery.data?.metadata.nextOffset != null) && (
          <Pagination offset={eventsOffset} limit={20} hasNext={eventsQuery.data?.metadata.nextOffset != null}
            onPrevious={() => setEventsOffset(Math.max(0, eventsOffset - 20))}
            onNext={() => eventsQuery.data?.metadata.nextOffset != null && setEventsOffset(eventsQuery.data.metadata.nextOffset)} />
        )}
      </section>
    </div>
  );
}
