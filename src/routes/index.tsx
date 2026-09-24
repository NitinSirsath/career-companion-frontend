import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isPast } from 'date-fns';
import { api } from '../api/client';
import { ApplicationResponse } from '../contracts/application';
import { ActionWithContextResponse } from '../contracts/action';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function ActionQueueSection() {
  const queryClient = useQueryClient();
  const { data: actionsResponse, isLoading } = useQuery({
    queryKey: ['actions', { status: 'PENDING' }],
    queryFn: () => api.getActions('PENDING'),
  });
  const actions = actionsResponse?.items;

  const updateMutation = useMutation({
    mutationFn: ({ actionId, status }: { actionId: string; status: 'COMPLETED' | 'DISMISSED' }) =>
      api.updateAction(actionId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground border border-border bg-surface-1">Loading action queue...</div>;
  }

  if (!actions || actions.length === 0) return null;

  const overdueActions = actions.filter(a => a.deadline && isPast(new Date(a.deadline)));
  const upcomingActions = actions.filter(a => a.deadline && !isPast(new Date(a.deadline)));
  const pendingActions = actions.filter(a => !a.deadline);

  const renderActionItem = (action: ActionWithContextResponse, isOverdue: boolean) => (
    <div key={action.id} className={`border p-4 flex flex-col md:flex-row gap-4 justify-between bg-surface-1 ${isOverdue ? 'border-status-error' : 'border-border'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          {isOverdue && <Badge variant="destructive">Overdue</Badge>}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {action.type.replace(/_/g, ' ')}
          </span>
          {action.deadline && (
            <span className={`text-xs ${isOverdue ? 'text-status-error font-medium' : 'text-muted-foreground'}`}>
              Due: {format(new Date(action.deadline), 'MMM d, yyyy h:mm a')}
            </span>
          )}
        </div>
        
        <p className="font-medium text-base">{action.description || 'Follow up required'}</p>
        
        <div className="mt-2 text-sm">
          <Link to="/applications/$id" params={{ id: action.applicationId }} className="font-medium text-primary hover:underline">
            {action.application.companyName} {action.application.jobTitle ? `— ${action.application.jobTitle}` : ''}
          </Link>
        </div>
      </div>

      <div className="flex flex-row md:flex-col gap-2 shrink-0 md:min-w-[140px] justify-end md:justify-start mt-2 md:mt-0">
        <Button variant="primary" size="sm" className="w-full" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ actionId: action.id, status: 'COMPLETED' })}>
          Complete
        </Button>
        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ actionId: action.id, status: 'DISMISSED' })}>
          Dismiss
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight border-b border-border pb-2">Action Center</h2>
      
      {overdueActions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-status-error uppercase tracking-wider">Overdue</h3>
          {overdueActions.map(a => renderActionItem(a, true))}
        </div>
      )}

      {upcomingActions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Upcoming</h3>
          {upcomingActions.map(a => renderActionItem(a, false))}
        </div>
      )}

      {pendingActions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pending</h3>
          {pendingActions.map(a => renderActionItem(a, false))}
        </div>
      )}
    </div>
  );
}

function AmbiguousMatchesSection({ applications }: { applications: ApplicationResponse[] }) {
  const queryClient = useQueryClient();
  const { data: ambiguousEmailsResponse, isLoading } = useQuery({ queryKey: ['ambiguous-emails'], queryFn: () => api.getAmbiguousEmails() });
  const ambiguousEmails = ambiguousEmailsResponse?.items;
  const resolveMutation = useMutation({
    mutationFn: ({ emailId, applicationId }: { emailId: string, applicationId: string | null }) => api.resolveAmbiguousEmail(emailId, { applicationId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ambiguous-emails'] }); queryClient.invalidateQueries({ queryKey: ['applications'] }); }
  });

  if (isLoading || !ambiguousEmails || ambiguousEmails.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-warning">Needs Review ({ambiguousEmails.length}{ambiguousEmailsResponse?.metadata?.nextOffset ? '+' : ''})</h3>
      <div className="space-y-3">
        {ambiguousEmails.map(email => (
          <div key={email.id} className="border border-border-default border-l-4 border-l-status-warning bg-surface p-4">
            <div className="flex flex-col md:flex-row gap-6 justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-warning">Uncertain Email Match</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs"><span className="font-medium text-muted-foreground">From:</span> {email.sender}</p>
                  {email.subject && <p className="text-xs"><span className="font-medium text-muted-foreground">Subject:</span> {email.subject}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 md:w-[280px]">
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Select Application</p>
                <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto">
                  {applications.map(app => (
                    <Button key={app.id} variant="tertiary" size="sm" className="justify-start truncate w-full" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate({ emailId: email.id, applicationId: app.id })}>
                      {app.companyName}
                    </Button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-1 w-full" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate({ emailId: email.id, applicationId: null })}>
                  Not related
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UnmatchedEmailsSection({ applications }: { applications: ApplicationResponse[] }) {
  const queryClient = useQueryClient();
  const { data: unmatchedEmailsResponse, isLoading } = useQuery({ queryKey: ['unmatched-emails'], queryFn: () => api.getUnmatchedEmails() });
  const unmatchedEmails = unmatchedEmailsResponse?.items;
  const resolveMutation = useMutation({
    mutationFn: ({ emailId, applicationId }: { emailId: string; applicationId: string }) => api.resolveUnmatchedEmail(emailId, { applicationId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['unmatched-emails'] }); queryClient.invalidateQueries({ queryKey: ['applications'] }); }
  });

  if (isLoading || !unmatchedEmails || unmatchedEmails.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-info">Unmatched Emails ({unmatchedEmails.length}{unmatchedEmailsResponse?.metadata?.nextOffset ? '+' : ''})</h3>
      <div className="space-y-3">
        {unmatchedEmails.map(email => (
          <div key={email.id} className="border border-border-default border-l-4 border-l-status-info bg-surface p-4">
            <div className="flex flex-col md:flex-row gap-6 justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-info">Needs Linking</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs"><span className="font-medium text-muted-foreground">From:</span> {email.sender}</p>
                  {email.subject && <p className="text-xs"><span className="font-medium text-muted-foreground">Subject:</span> {email.subject}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0 md:w-[280px]">
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Link to Application</p>
                <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto">
                  {applications.map(app => (
                    <Button key={app.id} variant="tertiary" size="sm" className="justify-start truncate w-full" disabled={resolveMutation.isPending} onClick={() => resolveMutation.mutate({ emailId: email.id, applicationId: app.id })}>
                      {app.companyName}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPage() {
  const { data: applicationsResponse } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.listApplications(),
  });
  const applications = applicationsResponse?.items;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Here is what needs your attention.</p>
      </div>

      <ActionQueueSection />

      {applications && (
        <div className="space-y-10">
          <UnmatchedEmailsSection applications={applications} />
          <AmbiguousMatchesSection applications={applications} />
        </div>
      )}
    </div>
  );
}
// Fix contract boundary mismatch
