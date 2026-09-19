import React from 'react';
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, isPast } from 'date-fns';
import { api } from '../api/client';
import { CreateApplicationRequestSchema, CreateApplicationRequest, ApplicationStatus, ApplicationResponse } from '../contracts/application';
import { ActionWithContextResponse } from '../contracts/action';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export const Route = createFileRoute('/applications')({
  component: ApplicationsPage,
});

// ─── Status badge helpers ─────────────────────────────────────────────────────

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  RECRUITER_CONTACT: 'Recruiter',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  APPLIED: 'bg-secondary text-secondary-foreground',
  RECRUITER_CONTACT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ASSESSMENT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  INTERVIEW: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  OFFER: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  CLOSED: 'bg-muted text-muted-foreground',
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// The effective status shown on the card — AI status takes precedence over user status
function effectiveStatus(app: ApplicationResponse): ApplicationStatus | null {
  return app.aiStatus ?? app.userStatus;
}

// ─── Event type labels ────────────────────────────────────────────────────────

function formatEventType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

// ─── Application card ─────────────────────────────────────────────────────────

function ApplicationCard({ app }: { app: ApplicationResponse }) {
  const status = effectiveStatus(app);

  return (
    <Link
      to="/applications/$id"
      params={{ id: app.id }}
      className="block rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md hover:border-primary/30 transition-all p-5 cursor-pointer"
      aria-label={`View timeline for ${app.companyName}${app.jobTitle ? ` — ${app.jobTitle}` : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-base leading-tight">{app.companyName}</h3>
            {status && <StatusBadge status={status} />}
            {app.pendingActionCount > 0 && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800"
                title={`${app.pendingActionCount} action${app.pendingActionCount > 1 ? 's' : ''} required`}
              >
                {app.pendingActionCount} action{app.pendingActionCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {app.jobTitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{app.jobTitle}</p>
          )}
          {app.location && (
            <p className="text-xs text-muted-foreground mt-0.5">{app.location}</p>
          )}
        </div>

        <div className="text-right text-xs text-muted-foreground shrink-0">
          {app.appliedAt && (
            <p>Applied {format(new Date(app.appliedAt), 'MMM d, yyyy')}</p>
          )}
          <p className="mt-0.5">Added {format(new Date(app.createdAt), 'MMM d')}</p>
        </div>
      </div>

      {app.recentEvent && (
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 text-foreground/60">●</span>
          <span>
            <span className="font-medium text-foreground/70">{formatEventType(app.recentEvent.type)}</span>
            {' · '}
            {format(new Date(app.recentEvent.createdAt as string), 'MMM d, yyyy')}
          </span>
        </div>
      )}
    </Link>
  );
}



// ─── Action Queue Section ─────────────────────────────────────────────────────

function ActionQueueSection() {
  const queryClient = useQueryClient();
  const { data: actions, isLoading } = useQuery({
    queryKey: ['actions', { status: 'PENDING' }],
    queryFn: () => api.getActions('PENDING'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ actionId, status }: { actionId: string; status: 'COMPLETED' | 'DISMISSED' }) =>
      api.updateAction(actionId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] }); // update pendingActionCount
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-xl border-dashed mb-8">
        Loading action queue...
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return null;
  }

  const overdueActions = actions.filter(a => a.deadline && isPast(new Date(a.deadline)));
  const upcomingActions = actions.filter(a => a.deadline && !isPast(new Date(a.deadline)));
  const pendingActions = actions.filter(a => !a.deadline);

  const renderActionItem = (action: ActionWithContextResponse, isOverdue: boolean) => (
    <div key={action.id} className={`rounded-xl border p-5 shadow-sm flex flex-col md:flex-row gap-4 justify-between ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {isOverdue && <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-destructive text-destructive-foreground">Overdue</span>}
          <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {action.type.replace(/_/g, ' ')}
          </span>
          {action.deadline && (
            <span className={`text-xs ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
              Due: {format(new Date(action.deadline), 'MMM d, yyyy h:mm a')}
            </span>
          )}
        </div>
        
        <p className="font-medium text-lg mt-1">{action.description || 'Follow up required'}</p>
        
        <div className="mt-2 text-sm text-muted-foreground">
          <Link to="/applications/$id" params={{ id: action.applicationId }} className="font-medium text-primary hover:underline">
            {action.application.companyName} {action.application.jobTitle ? `— ${action.application.jobTitle}` : ''}
          </Link>
        </div>

        {action.email && (
          <div className="mt-3 text-xs bg-background/50 p-2 rounded border border-border/50">
            <span className="font-semibold">Source Email: </span>
            {action.email.subject || 'No Subject'} <span className="text-muted-foreground">(from {action.email.sender})</span>
          </div>
        )}
      </div>

      <div className="flex flex-row md:flex-col gap-2 shrink-0 md:min-w-[150px] justify-end md:justify-start mt-2 md:mt-0">
        <Button
          variant="default"
          size="sm"
          className="w-full"
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate({ actionId: action.id, status: 'COMPLETED' })}
        >
          Mark Complete
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-muted-foreground"
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate({ actionId: action.id, status: 'DISMISSED' })}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 mb-8">
      <h2 className="text-2xl font-semibold tracking-tight">Next Steps</h2>
      
      {overdueActions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-destructive uppercase tracking-wider">Overdue</h3>
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

// ─── Ambiguous Matches Section ────────────────────────────────────────────────


function AmbiguousMatchesSection({ applications }: { applications: ApplicationResponse[] }) {
  const queryClient = useQueryClient();
  const { data: ambiguousEmails, isLoading } = useQuery({
    queryKey: ['ambiguous-emails'],
    queryFn: () => api.getAmbiguousEmails(),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ emailId, applicationId }: { emailId: string, applicationId: string | null }) => 
      api.resolveAmbiguousEmail(emailId, { applicationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ambiguous-emails'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    }
  });

  if (isLoading || !ambiguousEmails || ambiguousEmails.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <h3 className="text-lg font-medium text-orange-600 dark:text-orange-400">Needs Review ({ambiguousEmails.length})</h3>
      <div className="space-y-3">
        {ambiguousEmails.map(email => (
          <div key={email.id} className="rounded-xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/20 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6 justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">Uncertain Email Match</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground"><span className="font-medium">From:</span> {email.sender}</p>
                  {email.subject && <p className="text-xs text-muted-foreground"><span className="font-medium">Subject:</span> {email.subject}</p>}
                </div>
                
                {email.aiProcessingResult && (
                  <div className="mt-3 text-sm bg-background/60 p-3 rounded-lg border border-orange-200/50 dark:border-orange-900/30">
                    <p className="text-xs font-semibold text-foreground/70 mb-1">AI Extracted:</p>
                    <p className="font-medium">{email.aiProcessingResult.companyName || 'Unknown Company'}
                    {email.aiProcessingResult.jobTitle ? ` - ${email.aiProcessingResult.jobTitle}` : ''}</p>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-2 shrink-0 md:w-[280px]">
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Select Application</p>
                <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {applications.map(app => (
                    <Button 
                      key={app.id} 
                      variant="outline" 
                      size="sm" 
                      className="justify-start truncate w-full"
                      disabled={resolveMutation.isPending}
                      onClick={() => resolveMutation.mutate({ emailId: email.id, applicationId: app.id })}
                    >
                      {app.companyName} {app.jobTitle ? `— ${app.jobTitle}` : ''}
                    </Button>
                  ))}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground mt-1 w-full"
                  disabled={resolveMutation.isPending}
                  onClick={() => resolveMutation.mutate({ emailId: email.id, applicationId: null })}
                >
                  Not related to any application
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Unmatched Emails Section (COM-37) ────────────────────────────────────────

function UnmatchedEmailsSection({ applications }: { applications: ApplicationResponse[] }) {
  const queryClient = useQueryClient();
  const { data: unmatchedEmails, isLoading } = useQuery({
    queryKey: ['unmatched-emails'],
    queryFn: () => api.getUnmatchedEmails(),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ emailId, applicationId }: { emailId: string; applicationId: string }) =>
      api.resolveUnmatchedEmail(emailId, { applicationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unmatched-emails'] });
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  if (isLoading || !unmatchedEmails || unmatchedEmails.length === 0) return null;

  return (
    <div className="space-y-4 mb-8">
      <h3 className="text-lg font-medium text-blue-600 dark:text-blue-400">Unmatched Emails ({unmatchedEmails.length})</h3>
      <div className="space-y-3">
        {unmatchedEmails.map(email => (
          <div key={email.id} className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row gap-6 justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Needs Linking</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground"><span className="font-medium">From:</span> {email.sender}</p>
                  {email.subject && <p className="text-xs text-muted-foreground"><span className="font-medium">Subject:</span> {email.subject}</p>}
                </div>

                {email.aiProcessingResult && (
                  <div className="mt-3 text-sm bg-background/60 p-3 rounded-lg border border-blue-200/50 dark:border-blue-900/30">
                    <p className="text-xs font-semibold text-foreground/70 mb-1">AI Extracted:</p>
                    <p className="font-medium">{email.aiProcessingResult.companyName || 'Unknown Company'}
                    {email.aiProcessingResult.jobTitle ? ` - ${email.aiProcessingResult.jobTitle}` : ''}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 shrink-0 md:w-[280px]">
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Link to Application</p>
                <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {applications.map(app => (
                    <Button
                      key={app.id}
                      variant="outline"
                      size="sm"
                      className="justify-start truncate w-full"
                      disabled={resolveMutation.isPending}
                      onClick={() => resolveMutation.mutate({ emailId: email.id, applicationId: app.id })}
                    >
                      {app.companyName} {app.jobTitle ? `— ${app.jobTitle}` : ''}
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

// ─── Main page ────────────────────────────────────────────────────────────────


function ApplicationsDashboard() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.listApplications(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateApplicationRequest) => api.createApplication(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      form.reset();
      setShowCreateForm(false); // collapse form after successful save
    },
  });

  const form = useForm<CreateApplicationRequest>({
    resolver: zodResolver(CreateApplicationRequestSchema),
    defaultValues: {
      companyName: '',
      jobTitle: '',
      location: '',
      appliedAt: '',
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createMutation.mutate(data);
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Dashboard heading + primary action */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Applications</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreateForm((v) => !v)}
          aria-expanded={showCreateForm}
          aria-controls="create-application-form"
        >
          {showCreateForm ? '✕ Cancel' : '+ Add Application'}
        </Button>
      </div>

      {/* New Application Form — secondary action, collapsed by default */}
      {showCreateForm && (
        <div
          id="create-application-form"
          className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6"
        >
          <h3 className="text-lg font-medium mb-4">Track New Application</h3>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="Linear"
                  {...form.register('companyName')}
                />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-destructive font-medium">
                    {form.formState.errors.companyName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  placeholder="Frontend Engineer"
                  {...form.register('jobTitle')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Remote"
                  {...form.register('location')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appliedAt">Applied At</Label>
                <Input
                  id="appliedAt"
                  type="datetime-local"
                  {...form.register('appliedAt', {
                    setValueAs: (v: string) => v === "" ? undefined : new Date(v).toISOString()
                  })}
                />
              </div>
            </div>

            {createMutation.isError && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium">
                Error creating application: {createMutation.error.message}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Application'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Action Queue */}
      <ActionQueueSection />

      {/* Unmatched Emails */}
      {applications && <UnmatchedEmailsSection applications={applications} />}

      {/* Ambiguous Matches */}
      {applications && <AmbiguousMatchesSection applications={applications} />}

      {/* Application List */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Your Applications</h3>

        {isLoading ? (
          <div
            className="p-8 text-center text-muted-foreground border rounded-xl border-dashed"
            role="status"
            aria-label="Loading applications"
          >
            Loading applications...
          </div>
        ) : error ? (
          <div
            className="p-8 text-center text-destructive border-destructive/20 border rounded-xl bg-destructive/5"
            role="alert"
          >
            Failed to load applications: {error.message}
          </div>
        ) : !applications?.length ? (
          <div
            className="p-12 text-center text-muted-foreground border rounded-xl border-dashed"
            role="status"
          >
            <p className="text-base font-medium mb-1">No applications yet</p>
            <p className="text-sm">Add your first application above. AI-detected emails will appear automatically once Gmail is connected.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <ApplicationCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function ApplicationsPage() {
  const routerState = useRouterState();
  const isExact = routerState.location.pathname === '/applications'; 

  if (!isExact) {
    return <Outlet />;
  }

  return <ApplicationsDashboard />;
}
