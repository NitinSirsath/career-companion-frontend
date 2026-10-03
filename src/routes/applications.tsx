import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { api, isApiError } from '../api/client';
import { ApplicationStatusSchema, type ApplicationFilters, CreateApplicationRequestSchema, CreateApplicationRequest, ApplicationResponse } from '../contracts/application';
import { EffectiveStatus } from '../components/ApplicationStatus';
import { fetchApplicationsPage } from '../lib/applicationCache';
import { eventLabel } from '../lib/eventLabels';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { NativeSelect } from '../components/ui/native-select';
import { STATUS_LABEL } from '../lib/statusLabels';

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
      className="block border border-border-default bg-surface hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus transition-colors p-4"
    >
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-base break-words">{app.companyName}</h3>
            <EffectiveStatus app={app} />
            {app.archivedAt && <Badge>Archived</Badge>}
            {app.pendingActionCount > 0 && (
              <Badge variant="warning">
                {app.pendingActionCount} action{app.pendingActionCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <div className="mt-2 text-sm text-text-secondary break-words flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            {app.jobTitle && <span>{app.jobTitle}</span>}
            {app.location && <span className="hidden sm:inline">•</span>}
            {app.location && <span>{app.location}</span>}
          </div>
        </div>

        <div className="text-left sm:text-right text-xs text-muted-foreground shrink-0 mt-2 sm:mt-0">
          {app.appliedAt && (
            <p>Applied {format(new Date(app.appliedAt), 'MMM d, yyyy')}</p>
          )}
          {!app.appliedAt && <p>Applied date unknown</p>}
          <p className="mt-1">Added {format(new Date(app.createdAt), 'MMM d, yyyy')}</p>
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

type DiscoveryView = { offset: number; search: string } & Required<Pick<ApplicationFilters, 'archive' | 'sort'>> & {
  effectiveStatus: NonNullable<ApplicationFilters['effectiveStatus']> | '';
  submittedVia: NonNullable<ApplicationFilters['submittedVia']> | '';
};
const initialView: DiscoveryView = { offset: 0, search: '', archive: 'active', sort: 'added_desc', effectiveStatus: '', submittedVia: '' };

function ApplicationsDashboard({ view, setView }: { view: DiscoveryView; setView: Dispatch<SetStateAction<DiscoveryView>> }) {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { offset, search, effectiveStatus, archive, sort, submittedVia } = view;
  const setOffset = (offset: number) => setView(current => ({ ...current, offset }));
  const changeFilters = (changes: Partial<DiscoveryView>) => setView(current => ({ ...current, ...changes, offset: 0 }));
  // Set when a POST may have committed although its response was lost, timed out, failed with
  // 5xx or was malformed. The draft is kept and ordinary submission stays blocked.
  const [recovery, setRecovery] = useState<CreationRecovery>(null);
  const limit = 20;
  const filters = { archive, ...(search.trim() ? { q: search.trim() } : {}), ...(effectiveStatus ? { effectiveStatus } : {}), ...(submittedVia ? { submittedVia } : {}), ...(sort !== 'added_desc' ? { sort } : {}) };
  const hasFilters = !!(search.trim() || effectiveStatus || submittedVia || archive !== 'active');
  const params = { offset, limit, ...filters };

  const { data: applicationsResponse, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['applications', params],
    queryFn: ({ signal }) => fetchApplicationsPage(queryClient, params, signal),
  });

  const applications = applicationsResponse?.items || [];
  const nextOffset = applicationsResponse?.metadata?.nextOffset;
  useEffect(() => {
    if (applicationsResponse && !isFetching && !error && applicationsResponse.items.length === 0 && offset > 0) {
      setView(current => ({ ...current, offset: 0 }));
    }
  }, [applicationsResponse, isFetching, error, offset, setView]);

  async function reconcileCreation() {
    setRecovery({ refresh: 'pending' });
    setView(initialView);
    try {
      await queryClient.fetchQuery({
        queryKey: ['applications', { offset: 0, limit, archive: 'active' }],
        queryFn: ({ signal }) => fetchApplicationsPage(queryClient, { offset: 0, limit, archive: 'active' }, signal),
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
      setView(initialView);
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
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-default pb-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Applications</h2>
          <p className="text-sm text-text-secondary">Your recorded applications, from submission through the next steps.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? 'Refreshing…' : 'Refresh applications'}
          </Button>
          <Button variant="tertiary" size="sm" onClick={() => setShowCreateForm(true)}>Add Application</Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="application-search">Search company or job title</Label>
          <Input id="application-search" type="search" maxLength={100} value={search}
            onChange={(event) => changeFilters({ search: event.target.value })} placeholder="Company or job title" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="application-status-filter">Effective status</Label>
            <NativeSelect id="application-status-filter" value={effectiveStatus}
              onChange={(event) => changeFilters({ effectiveStatus: event.target.value as DiscoveryView['effectiveStatus'] })}>
              <option value="">All statuses</option>
              <option value="UNKNOWN">No user/AI status</option>
              {ApplicationStatusSchema.options.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="application-source-filter">Submission source</Label>
            <NativeSelect id="application-source-filter" value={submittedVia}
              onChange={(event) => changeFilters({ submittedVia: event.target.value as DiscoveryView['submittedVia'] })}>
              <option value="">All sources</option>
              <option value="AUTOMATION">Via automation</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="application-archive-filter">Application visibility</Label>
            <NativeSelect id="application-archive-filter" value={archive}
              onChange={(event) => changeFilters({ archive: event.target.value as DiscoveryView['archive'] })}>
              <option value="active">Active</option><option value="archived">Archived</option><option value="all">All applications</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="application-sort">Sort applications</Label>
            <NativeSelect id="application-sort" value={sort}
              onChange={(event) => changeFilters({ sort: event.target.value as DiscoveryView['sort'] })}>
              <option value="added_desc">Newest added</option>
              <option value="applied_desc">Applied date: newest first</option>
              <option value="applied_asc">Applied date: oldest first</option>
              <option value="company_asc">Company: A–Z</option>
            </NativeSelect>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-text-secondary">
          <p>Submissions awaiting a match are in <Link to="/automation" className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-focus">Automation review</Link>.</p>
          {(hasFilters || sort !== 'added_desc') && <Button variant="ghost" size="sm" onClick={() => setView(initialView)}>Clear filters</Button>}
        </div>
        {effectiveStatus === 'UNKNOWN' && <p className="text-sm text-text-secondary">No user or AI status has been set. An automation submission can still be recorded.</p>}
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
          <div role="alert" className="p-8 text-center text-status-error border border-status-error bg-status-error-subtle space-y-3">
            <p>Failed to load applications: {error.message}</p>
            <Button variant="secondary" disabled={isFetching} onClick={() => void refetch()}>Retry applications</Button>
          </div>
        ) : !applications?.length ? (
          <div className="p-12 text-center border border-border bg-surface-1">
            <p className="text-base font-medium mb-2">{hasFilters ? 'No matching applications' : 'No applications yet'}</p>
            <p className="text-sm text-text-secondary">{hasFilters ? 'Try changing your search, status, source or visibility filters.' : 'Add an application, connect Gmail, or record a submission through your automation. Archived applications are available under Application visibility.'}</p>
          </div>
        ) : (
          <>
            <p role="status" className="text-sm text-text-secondary">Showing {offset + 1}–{offset + applications.length}{isFetching ? ' · Refreshing…' : ''}</p>
            <div className="space-y-3">
              {applications.map((app) => <ApplicationCard key={app.id} app={app} />)}
            </div>
            {(offset > 0 || nextOffset) && (
              <Pagination 
                offset={offset} 
                limit={limit} 
                hasNext={!isFetching && !!nextOffset}
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
  // Keep private discovery state through child detail visits; do not persist it in URLs/storage.
  const [view, setView] = useState<DiscoveryView>(initialView);
  const routerState = useRouterState();
  const isExact = routerState.location.pathname === '/applications'; 
  if (!isExact) return <Outlet />;
  return <ApplicationsDashboard view={view} setView={setView} />;
}
