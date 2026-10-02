import { useState } from 'react';

import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { api, isApiError } from '../api/client';
import { CreateApplicationRequestSchema, CreateApplicationRequest, ApplicationResponse } from '../contracts/application';
import { EffectiveStatus } from '../components/ApplicationStatus';
import { fetchApplicationsPage } from '../lib/applicationCache';
import { eventLabel } from '../lib/eventLabels';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';

import { Pagination } from '../components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';

export const Route = createFileRoute('/applications')({
  component: ApplicationsPage,
});

function ApplicationCard({ app }: { app: ApplicationResponse }) {
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
            <EffectiveStatus app={app} />
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
            <span className="font-medium text-foreground">{eventLabel(app.recentEvent.type)}</span>
            {' · Recorded '}
            {format(new Date(app.recentEvent.recordedAt), 'MMM d, yyyy')}
          </span>
        </div>
      )}
    </Link>
  );
}

type CreationRecovery = { refresh: 'pending' | 'failed' | 'done' } | null;

function ApplicationsDashboard() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [offset, setOffset] = useState(0);
  // Set when a POST may have committed although its response was lost, timed out, failed with
  // 5xx or was malformed. The draft is kept and ordinary submission stays blocked.
  const [recovery, setRecovery] = useState<CreationRecovery>(null);
  const limit = 20;

  const { data: applicationsResponse, isLoading, error } = useQuery({
    queryKey: ['applications', { offset, limit }],
    queryFn: ({ signal }) => fetchApplicationsPage(queryClient, { offset, limit }, signal),
  });

  const applications = applicationsResponse?.items || [];
  const nextOffset = applicationsResponse?.metadata?.nextOffset;

  async function reconcileCreation() {
    setRecovery({ refresh: 'pending' });
    setOffset(0);
    try {
      await queryClient.fetchQuery({
        queryKey: ['applications', { offset: 0, limit }],
        queryFn: ({ signal }) => fetchApplicationsPage(queryClient, { offset: 0, limit }, signal),
        staleTime: 0,
      });
      setRecovery({ refresh: 'done' });
    } catch {
      setRecovery({ refresh: 'failed' });
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateApplicationRequest) => api.createApplication(data),
    retry: false, // never replay a POST automatically
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setOffset(0);
      setRecovery(null);
      form.reset();
      setShowCreateForm(false);
    },
    onError: (err) => {
      if (isApiError(err) && !err.outcomeUncertain) return; // definitive rejection: draft stays editable
      void reconcileCreation();
    },
  });

  const form = useForm<CreateApplicationRequest>({
    resolver: zodResolver(CreateApplicationRequestSchema),
    defaultValues: { companyName: '', jobTitle: '', location: '', appliedAt: '' },
  });

  const onSubmit = form.handleSubmit((data) => {
    if (createMutation.isPending || recovery) return;
    createMutation.mutate(data);
  });
  // Deliberate new POST after review; the earlier request may already have created a record.
  const createAnyway = form.handleSubmit((data) => {
    setRecovery(null);
    createMutation.mutate(data);
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Applications</h2>
        <Button
          variant="tertiary"
          size="sm"
          onClick={() => setShowCreateForm(true)}
        >
          Add Application
        </Button>
      </div>

      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Track New Application</DialogTitle>
          </DialogHeader>
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
            {createMutation.isError && !recovery && (
              <div role="alert" className="p-3 bg-destructive/10 text-destructive text-sm font-medium">
                Error creating application: {createMutation.error.message}
              </div>
            )}
            {recovery && (
              <div role="alert" className="p-3 border border-status-warning bg-status-warning-subtle text-sm space-y-2">
                <p className="font-semibold">Creation outcome unknown</p>
                <p>
                  We couldn't confirm whether this application was saved. It may already exist. Your
                  details are kept below.
                </p>
                {recovery.refresh === 'pending' && <p role="status">Refreshing your applications…</p>}
                {recovery.refresh === 'failed' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Your applications could not be loaded.</span>
                    <Button type="button" size="sm" variant="tertiary" onClick={() => void reconcileCreation()}>
                      Retry refresh
                    </Button>
                  </div>
                )}
                {recovery.refresh === 'done' && (
                  <>
                    <p>
                      Review your applications list before creating again. A similar entry does not prove
                      which request created it, and a missing entry does not prove it failed.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="tertiary" onClick={() => setShowCreateForm(false)}>
                        Review applications
                      </Button>
                      <Button type="button" size="sm" variant="secondary" disabled={createMutation.isPending} onClick={() => void createAnyway()}>
                        Create anyway
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !!recovery} variant="primary">
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
          <>
            <div className="space-y-3">
              {applications.map((app) => <ApplicationCard key={app.id} app={app} />)}
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
          </>
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
