import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { PageHeader } from '../components/layout/PageHeader';
import { Add, Renew } from '@carbon/icons-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, isApiError } from '../api/client';
import { CreateApplicationRequestSchema, CreateApplicationRequest } from '../contracts/application';
import { useSearchText } from '../components/useSearchText';
import { fetchApplicationsPage } from '../lib/applicationCache';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Reveal } from '../components/ui/reveal';
import { Select } from '../components/ui/select';

import { Pagination } from '../components/ui/pagination';
import { ApplicationsTable } from '../components/applications/ApplicationsTable';
import { EmptyState } from '../components/ui/empty-state';
import { SectionError } from '../components/ui/section-error';
import { Tabs } from '../components/ui/tabs';
import { FilterChips, Toolbar, ToolbarSearch } from '../components/ui/toolbar';
import {
  ARCHIVE_OPTIONS,
  INITIAL_VIEW,
  SORT_OPTIONS,
  STATUS_TABS,
  applicationsSearchSchema,
  searchFromView,
  tabFilters,
  viewFromSearch,
  type DiscoveryView,
  type StatusTab,
} from '../lib/applicationsView';
import { rememberListSearch } from '../lib/listMemory';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';

export const Route = createFileRoute('/applications')({
  errorComponent: RouteErrorPage,
  validateSearch: applicationsSearchSchema,
  component: ApplicationsPage,
});

type CreationRecovery = { refresh: 'pending' | 'failed' | 'done' } | null;

function ApplicationsDashboard({
  view,
  setView,
}: {
  view: DiscoveryView;
  setView: Dispatch<SetStateAction<DiscoveryView>>;
}) {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { offset, search, tab, archive, sort } = view;
  const setOffset = (offset: number) => setView((current) => ({ ...current, offset }));
  const changeFilters = (changes: Partial<DiscoveryView>) =>
    setView((current) => ({ ...current, ...changes, offset: 0 }));
  const [searchText, setSearchText] = useSearchText(search, (text) =>
    changeFilters({ search: text }),
  );

  const { effectiveStatus, submittedVia } = tabFilters(tab);

  // Set when a POST may have committed although its response was lost, timed out, failed with
  // 5xx or was malformed. The draft is kept and ordinary submission stays blocked.
  const [recovery, setRecovery] = useState<CreationRecovery>(null);
  const limit = 20;
  const filters = {
    archive,
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(effectiveStatus ? { effectiveStatus } : {}),
    ...(submittedVia ? { submittedVia } : {}),
    ...(sort !== 'added_desc' ? { sort } : {}),
  };
  const hasFilters = !!(search.trim() || tab !== 'ALL' || archive !== 'active');
  const params = { offset, limit, ...filters };

  const {
    data: applicationsResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['applications', params],
    queryFn: ({ signal }) => fetchApplicationsPage(queryClient, params, signal),
  });

  const applications = applicationsResponse?.items || [];
  const nextOffset = applicationsResponse?.metadata?.nextOffset;
  useEffect(() => {
    if (
      applicationsResponse &&
      !isFetching &&
      !error &&
      applicationsResponse.items.length === 0 &&
      offset > 0
    ) {
      setView((current) => ({ ...current, offset: 0 }));
    }
  }, [applicationsResponse, isFetching, error, offset, setView]);

  async function reconcileCreation() {
    setRecovery({ refresh: 'pending' });
    setView(INITIAL_VIEW);
    try {
      await queryClient.fetchQuery({
        queryKey: ['applications', { offset: 0, limit, archive: 'active' }],
        queryFn: ({ signal }) =>
          fetchApplicationsPage(queryClient, { offset: 0, limit, archive: 'active' }, signal),
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
      setView(INITIAL_VIEW);
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
      <PageHeader
        className="mb-0"
        title="Applications"
        description="Every job you applied for, where it stands, and what is next."
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={isFetching ? 'Refreshing…' : 'Refresh applications'}
              title="Refresh applications"
              loading={isFetching}
              onClick={() => void refetch()}
            >
              {!isFetching && <Renew size={16} aria-hidden="true" />}
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              Add application
              <Add size={16} aria-hidden="true" />
            </Button>
          </>
        }
      />

      <Tabs<StatusTab>
        label="Status"
        value={tab}
        onValueChange={(next) => changeFilters({ tab: next })}
        items={STATUS_TABS}
      />
      {tab === 'SUBMITTED' && (
        <p className="text-sm text-text-secondary">
          These applications were sent by your automation but have no company confirmation yet.
          Submissions waiting for a match are in <Link to="/automation">Automation review</Link>.
        </p>
      )}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add application</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company</Label>
                  <Input
                    id="companyName"
                    placeholder="e.g. Linear"
                    {...form.register('companyName')}
                  />
                </div>
                {form.formState.errors.companyName && (
                  <Reveal>
                    <p className="pt-2 text-sm text-destructive">
                      {form.formState.errors.companyName.message}
                    </p>
                  </Reveal>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job title (optional)</Label>
                <Input
                  id="jobTitle"
                  placeholder="Frontend Engineer"
                  {...form.register('jobTitle')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Input id="location" placeholder="Remote" {...form.register('location')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appliedAt">Applied on (optional)</Label>
                <Input
                  id="appliedAt"
                  type="datetime-local"
                  {...form.register('appliedAt', {
                    setValueAs: (v: string) => (v === '' ? undefined : new Date(v).toISOString()),
                  })}
                />
              </div>
            </div>
            {createMutation.isError && !recovery && (
              <div
                role="alert"
                className="p-3 bg-destructive/10 text-destructive text-sm font-medium"
              >
                Error creating application: {createMutation.error.message}
              </div>
            )}
            {recovery && (
              <div
                role="alert"
                className="p-3 border border-status-warning bg-status-warning-subtle text-sm space-y-2"
              >
                <p className="font-semibold">Creation outcome unknown</p>
                <p>
                  We couldn't confirm whether this application was saved. It may already exist. Your
                  details are kept below.
                </p>
                {recovery.refresh === 'pending' && (
                  <p role="status">Refreshing your applications…</p>
                )}
                {recovery.refresh === 'failed' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Your applications could not be loaded.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="tertiary"
                      onClick={() => void reconcileCreation()}
                    >
                      Retry refresh
                    </Button>
                  </div>
                )}
                {recovery.refresh === 'done' && (
                  <>
                    <p>
                      Review your applications list before creating again. A similar entry does not
                      prove which request created it, and a missing entry does not prove it failed.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="tertiary"
                        onClick={() => setShowCreateForm(false)}
                      >
                        Review applications
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={createMutation.isPending}
                        onClick={() => void createAnyway()}
                      >
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
              <Button
                type="submit"
                disabled={createMutation.isPending || !!recovery}
                variant="primary"
              >
                {createMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ApplicationsTable
        applications={error ? [] : applications}
        loading={isLoading}
        toolbar={
          <div>
            <Toolbar
              filterCount={(archive !== 'active' ? 1 : 0) + (search.trim() ? 1 : 0)}
              search={
                <ToolbarSearch
                  label="Search company or job title"
                  value={searchText}
                  onChange={setSearchText}
                  placeholder="Search company or job title"
                />
              }
              filters={(layout) => (
                <Select<DiscoveryView['archive']>
                  id={`application-archive-filter-${layout}`}
                  label="Application visibility"
                  appearance={layout === 'inline' ? 'inline' : 'field'}
                  value={archive}
                  options={ARCHIVE_OPTIONS}
                  onValueChange={(next) => changeFilters({ archive: next })}
                />
              )}
              end={(layout) => (
                <Select<DiscoveryView['sort']>
                  id={`application-sort-${layout}`}
                  label="Sort applications"
                  appearance={layout === 'inline' ? 'inline' : 'field'}
                  value={sort}
                  options={SORT_OPTIONS}
                  onValueChange={(next) => changeFilters({ sort: next })}
                />
              )}
            />
            <FilterChips
              chips={[
                ...(search.trim()
                  ? [
                      {
                        label: `Search: ${search.trim()}`,
                        onRemove: () => changeFilters({ search: '' }),
                      },
                    ]
                  : []),
                ...(tab !== 'ALL'
                  ? [
                      {
                        label: `Status: ${STATUS_TABS.find((t) => t.value === tab)?.label}`,
                        onRemove: () => changeFilters({ tab: 'ALL' }),
                      },
                    ]
                  : []),
                ...(archive !== 'active'
                  ? [
                      {
                        label: `Show: ${ARCHIVE_OPTIONS.find((o) => o.value === archive)?.label}`,
                        onRemove: () => changeFilters({ archive: 'active' }),
                      },
                    ]
                  : []),
              ]}
              onClearAll={() => setView(INITIAL_VIEW)}
            />
          </div>
        }
        empty={
          error ? (
            <SectionError
              className="my-4"
              title="Could not load your applications"
              onRetry={() => void refetch()}
            />
          ) : hasFilters ? (
            <EmptyState
              title="No matching applications"
              action={
                <Button variant="ghost" className="-ml-4" onClick={() => setView(INITIAL_VIEW)}>
                  Clear all filters
                </Button>
              }
            >
              Try changing the search, the status or what is shown.
            </EmptyState>
          ) : (
            <EmptyState title="No applications yet">
              Add one, connect Gmail, or let your automation record what it sends. Submissions
              waiting for a match are in <Link to="/automation">Automation</Link>.
            </EmptyState>
          )
        }
        footer={
          (offset > 0 || !!nextOffset) && (
            <Pagination
              offset={offset}
              limit={limit}
              summary={`Showing ${offset + 1}–${offset + applications.length}${isFetching ? ' · Refreshing…' : ''}`}
              hasNext={!isFetching && !!nextOffset}
              onPrevious={() => setOffset(Math.max(0, offset - limit))}
              onNext={() => nextOffset && setOffset(nextOffset)}
            />
          )
        }
      />
    </div>
  );
}

function ApplicationsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const routerState = useRouterState();
  const isExact = routerState.location.pathname === '/applications';
  const view = viewFromSearch(search);
  // Remembered so the breadcrumb and the menu return to this exact view.
  useEffect(() => {
    if (isExact) rememberListSearch('/applications', search);
  }, [isExact, search]);
  // Stable like a state setter, and reading the latest view, so effects that change the view run
  // once and back-to-back changes add up instead of overwriting each other.
  const latest = useRef(view);
  latest.current = view;
  const setView: Dispatch<SetStateAction<DiscoveryView>> = useCallback(
    (next) => {
      const value = typeof next === 'function' ? next(latest.current) : next;
      latest.current = value;
      void navigate({ search: searchFromView(value), replace: true });
    },
    [navigate],
  );
  if (!isExact) return <Outlet />;
  return <ApplicationsDashboard view={view} setView={setView} />;
}
