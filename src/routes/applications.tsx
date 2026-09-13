import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { api } from '../api/client';
import { CreateApplicationRequestSchema, CreateApplicationRequest, ApplicationStatus, ApplicationResponse } from '../contracts/application';
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

// ─── Main page ────────────────────────────────────────────────────────────────

function ApplicationsDashboard() {
  const queryClient = useQueryClient();

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.listApplications(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateApplicationRequest) => api.createApplication(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      form.reset();
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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Applications</h2>
      </div>

      {/* New Application Form */}
      <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">
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
            <p className="text-sm">Track your first job application above. AI-detected emails will appear automatically once Gmail is connected.</p>
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
