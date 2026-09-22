import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../api/client';
import { ApplicationStatus, ApplicationEventResponse, ApplicationActionResponse } from '../contracts/application';
import { Button } from '../components/ui/button';

export const Route = createFileRoute('/applications/$id')({
  component: ApplicationDetailPage,
});

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  RECRUITER_CONTACT: 'Recruiter Contact',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  APPLIED: 'bg-secondary text-secondary-foreground',
  RECRUITER_CONTACT: 'bg-status-info-subtle text-status-info',
  ASSESSMENT: 'bg-status-warning-subtle text-status-warning',
  INTERVIEW: 'bg-status-neutral-subtle text-status-neutral',
  OFFER: 'bg-status-success-subtle text-status-success',
  REJECTED: 'bg-status-error-subtle text-status-error',
  CLOSED: 'bg-muted text-muted-foreground',
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Event type → human label ─────────────────────────────────────────────────

function formatEventType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

// ─── Timeline dot ─────────────────────────────────────────────────────────────

function TimelineDot({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    EMAIL_PROCESSED: 'bg-status-info',
    STATE_INFERRED: 'bg-status-neutral',
    NOTE_ADDED: 'bg-status-neutral',
  };
  const color = colorMap[type] ?? 'bg-muted-foreground';
  return <span className={`mt-1 shrink-0 h-2.5 w-2.5 rounded-full ${color}`} aria-hidden="true" />;
}

// ─── Timeline event item ──────────────────────────────────────────────────────

function TimelineEventItem({ event }: { event: ApplicationEventResponse }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <TimelineDot type={event.type} />
      </div>
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-semibold">{formatEventType(event.type)}</p>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
            )}
            {(event.oldState || event.newState) && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {event.oldState && (
                  <>
                    <StatusBadge status={event.oldState} />
                    <span className="text-xs text-muted-foreground">→</span>
                  </>
                )}
                {event.newState && <StatusBadge status={event.newState} />}
              </div>
            )}
            {event.provenance && (
              <p className="text-xs text-muted-foreground mt-1 italic">Source: {event.provenance}</p>
            )}
          </div>
          <time
            className="text-xs text-muted-foreground whitespace-nowrap shrink-0"
            dateTime={new Date(event.createdAt).toISOString()}
          >
            {format(new Date(event.createdAt), 'MMM d, yyyy · h:mm a')}
          </time>
        </div>
      </div>
    </div>
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
    },
  });

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${isPending ? 'border-status-warning bg-status-warning-subtle' : 'border-border bg-muted/30'}`}>
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

// ─── Main page ────────────────────────────────────────────────────────────────

function ApplicationDetailPage() {
  const { id } = Route.useParams();

  // Reuse list query (already cached from dashboard visit)
  const { data: applications } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.listApplications(),
    staleTime: 30_000,
  });

  const application = applications?.find((a) => a.id === id);

  const {
    data: events,
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery({
    queryKey: ['application-events', id],
    queryFn: () => api.getApplicationEvents(id),
  });

  const {
    data: actions,
    isLoading: actionsLoading,
    error: actionsError,
  } = useQuery({
    queryKey: ['application-actions', id],
    queryFn: () => api.getApplicationActions(id),
  });

  const isLoading = eventsLoading || actionsLoading;
  const hasError = !!(eventsError || actionsError);

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

      {/* Header */}
      {application && (
        <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{application.companyName}</h2>
              {application.jobTitle && (
                <p className="text-muted-foreground mt-0.5">{application.jobTitle}</p>
              )}
              {application.location && (
                <p className="text-sm text-muted-foreground">{application.location}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {(application.aiStatus ?? application.userStatus) && (
                <StatusBadge status={(application.aiStatus ?? application.userStatus)!} />
              )}
              {application.appliedAt && (
                <p className="text-xs text-muted-foreground">
                  Applied {format(new Date(application.appliedAt), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div
          className="p-8 text-center text-muted-foreground border rounded-xl border-dashed"
          role="status"
          aria-label="Loading application details"
        >
          Loading application details...
        </div>
      )}

      {/* Error */}
      {!isLoading && hasError && (
        <div
          className="p-8 text-center text-destructive border-destructive/20 border rounded-xl bg-destructive/5"
          role="alert"
        >
          Failed to load application data: {(eventsError ?? actionsError)?.message}
        </div>
      )}

      {/* Actions section */}
      {!isLoading && !hasError && actions && actions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Actions</h3>
          <div className="space-y-2">
            {actions.map((action) => (
              <ActionItem key={action.id} action={action} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline section */}
      {!isLoading && !hasError && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Timeline</h3>

          {events && events.length === 0 ? (
            <div
              className="p-10 text-center text-muted-foreground border rounded-xl border-dashed"
              role="status"
            >
              <p className="text-sm font-medium mb-1">No events yet</p>
              <p className="text-xs">Events appear when emails are processed by Gmail AI intelligence.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
              <div className="relative">
                <div
                  className="absolute left-[5px] top-3 bottom-3 w-px bg-border"
                  aria-hidden="true"
                />
                <div className="space-y-0">
                  {events?.map((event) => (
                    <TimelineEventItem key={event.id} event={event} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
