import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { TopBarActions } from '../components/layout/Breadcrumb';
import { PageHeader } from '../components/layout/PageHeader';
import { TopBarSearch } from '../components/layout/TopBarButtons';
import { useIsPhone } from '../components/layout/useIsPhone';
import { Renew } from '@carbon/icons-react';
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchText } from '../components/useSearchText';
import { fetchApplicationsPage } from '../lib/applicationCache';

import { Button } from '../components/ui/button';
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

export const Route = createFileRoute('/applications')({
  errorComponent: RouteErrorPage,
  validateSearch: applicationsSearchSchema,
  component: ApplicationsPage,
});

/** The search box's id, for the phone top bar's search button. */
const APPLICATION_SEARCH_ID = 'application-search';

function ApplicationsDashboard({
  view,
  setView,
}: {
  view: DiscoveryView;
  setView: Dispatch<SetStateAction<DiscoveryView>>;
}) {
  const queryClient = useQueryClient();
  const phone = useIsPhone();
  const { offset, search, tab, archive, sort } = view;
  const setOffset = (offset: number) => setView((current) => ({ ...current, offset }));
  const changeFilters = (changes: Partial<DiscoveryView>) =>
    setView((current) => ({ ...current, ...changes, offset: 0 }));
  const [searchText, setSearchText] = useSearchText(search, (text) =>
    changeFilters({ search: text }),
  );

  const { effectiveStatus, submittedVia } = tabFilters(tab);

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

  return (
    <div className="space-y-8 max-md:space-y-4">
      {phone && (
        <TopBarActions>
          <TopBarSearch targetId={APPLICATION_SEARCH_ID} label="Search applications" />
        </TopBarActions>
      )}
      <PageHeader
        phoneCompact
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
          </>
        }
      />

      <Tabs<StatusTab>
        label="Status"
        value={tab}
        onValueChange={(next) => changeFilters({ tab: next })}
        items={STATUS_TABS}
        phoneLook="chips"
      />
      {tab === 'SUBMITTED' && (
        <p className="text-sm text-text-secondary">
          These applications were sent by your automation but have no company confirmation yet.
          Submissions waiting for a match are in <Link to="/automation">Automation review</Link>.
        </p>
      )}
      <ApplicationsTable
        applications={error ? [] : applications}
        loading={isLoading}
        toolbar={
          <div>
            <Toolbar
              filterCount={(archive !== 'active' ? 1 : 0) + (search.trim() ? 1 : 0)}
              search={
                <ToolbarSearch
                  id={APPLICATION_SEARCH_ID}
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
              They appear here when the app finds one in your mails, or when your automation records
              one. Submissions waiting for a match are in <Link to="/automation">Automation</Link>.
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
