import React from "react";
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
import { Badge } from '../components/ui/badge';

export const Route = createFileRoute('/applications')({
  component: ApplicationsPage,
});

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  RECRUITER_CONTACT: 'Recruiter',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

function getBadgeVariant(status: ApplicationStatus): "default" | "success" | "warning" | "destructive" | "info" | "outline" | "secondary" {
  switch (status) {
    case 'APPLIED': return 'secondary';
    case 'RECRUITER_CONTACT': return 'info';
    case 'ASSESSMENT': return 'warning';
    case 'INTERVIEW': return 'info';
    case 'OFFER': return 'success';
    case 'REJECTED': return 'destructive';
    case 'CLOSED': return 'outline';
    default: return 'outline';
  }
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge variant={getBadgeVariant(status)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function effectiveStatus(app: ApplicationResponse): ApplicationStatus | null {
  return app.aiStatus ?? app.userStatus;
}

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function ApplicationCard({ app }: { app: ApplicationResponse }) {
  const status = effectiveStatus(app);

  return (
    <Link
      to="/applications/$id"
      params={{ id: app.id }}
      className="block border border-border bg-surface-1 hover:border-primary/50 transition-colors p-4"
    >
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-base">{app.companyName}</h3>
            {status && <StatusBadge status={status} />}
            {app.pendingActionCount > 0 && (
              <Badge variant="warning">
                {app.pendingActionCount} action{app.pendingActionCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <div className="mt-2 text-sm text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            {app.jobTitle && <span>{app.jobTitle}</span>}
            {app.location && <span className="hidden sm:inline">•</span>}
            {app.location && <span>{app.location}</span>}
          </div>
        </div>

        <div className="text-left sm:text-right text-xs text-muted-foreground shrink-0 mt-2 sm:mt-0">
          {app.appliedAt && (
            <p>Applied {format(new Date(app.appliedAt), 'MMM d, yyyy')}</p>
          )}
          <p className="mt-1">Added {format(new Date(app.createdAt), 'MMM d')}</p>
        </div>
      </div>

      {app.recentEvent && (
        <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0 text-foreground">●</span>
          <span>
            <span className="font-medium text-foreground">{formatEventType(app.recentEvent.type)}</span>
            {' · '}
            {format(new Date(app.recentEvent.createdAt as string), 'MMM d, yyyy')}
          </span>
        </div>
      )}
    </Link>
  );
}

function ApplicationsDashboard() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  const { data: applicationsResponse, isLoading, error } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api.listApplications(),
  });

  const applications = applicationsResponse?.items || [];
  const createMutation = useMutation({
    mutationFn: (data: CreateApplicationRequest) => api.createApplication(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      form.reset();
      setShowCreateForm(false);
    },
  });

  const form = useForm<CreateApplicationRequest>({
    resolver: zodResolver(CreateApplicationRequestSchema),
    defaultValues: { companyName: '', jobTitle: '', location: '', appliedAt: '' },
  });

  const onSubmit = form.handleSubmit((data) => createMutation.mutate(data));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Applications</h2>
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => setShowCreateForm((v) => !v)}
          aria-expanded={showCreateForm}
        >
          {showCreateForm ? 'Cancel' : 'Add Application'}
        </Button>
      </div>

      {showCreateForm && (
        <div className="border border-border bg-surface-1 p-6">
          <h3 className="text-lg font-medium mb-4">Track New Application</h3>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input id="companyName" placeholder="e.g. Linear" {...form.register('companyName')} />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-destructive">{form.formState.errors.companyName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input id="jobTitle" placeholder="Frontend Engineer" {...form.register('jobTitle')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="Remote" {...form.register('location')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appliedAt">Applied At</Label>
                <Input id="appliedAt" type="datetime-local" {...form.register('appliedAt', { setValueAs: (v: string) => v === "" ? undefined : new Date(v).toISOString() })} />
              </div>
            </div>
            {createMutation.isError && (
              <div className="p-3 bg-destructive/10 text-destructive text-sm font-medium">
                Error creating application: {createMutation.error.message}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={createMutation.isPending} variant="primary">
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground border border-border bg-surface-1">Loading applications...</div>
        ) : error ? (
          <div className="p-8 text-center text-destructive border border-destructive bg-destructive/10">Failed to load applications: {error.message}</div>
        ) : !applications?.length ? (
          <div className="p-12 text-center border border-border bg-surface-1">
            <p className="text-base font-medium mb-2">No applications yet</p>
            <p className="text-sm text-muted-foreground">Add your first application to get started. AI-detected emails will link automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => <ApplicationCard key={app.id} app={app} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationsPage() {
  const routerState = useRouterState();
  const isExact = routerState.location.pathname === '/applications'; 
  if (!isExact) return <Outlet />;
  return <ApplicationsDashboard />;
}
