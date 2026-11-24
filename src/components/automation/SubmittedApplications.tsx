import { useState } from 'react';
import { SendIcon } from 'lucide-react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApplicationsPage } from '../../lib/applicationCache';
import { ApplicationsTable } from '../applications/ApplicationsTable';
import { EmptyState } from '../ui/empty-state';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { TabPanel, Tabs } from '../ui/tabs';
import { ApplyTaskList } from './ApplyTaskList';

const LIMIT = 20;

const VIEWS = [
  { value: 'tasks', label: 'By task' },
  { value: 'all', label: 'All' },
] as const;
type View = (typeof VIEWS)[number]['value'];

/**
 * What the automation sent: grouped by run (owner, 25 Nov 2026), or every application in one list
 * as before.
 */
export function SubmittedApplications() {
  const [view, setView] = useState<View>('tasks');
  return (
    <section aria-labelledby="submitted-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="submitted-title" className="text-base font-semibold">
          Applications your automation sent
        </h2>
        <p className="text-sm text-text-secondary">
          Each run of NorthList Apply is one task, named by the time it started. Every application
          is also in Applications.
        </p>
      </div>
      <Tabs<View> label="Show" items={VIEWS} value={view} onValueChange={setView} phoneLook="chips">
        <TabPanel value="tasks" className="pt-4">
          <ApplyTaskList />
        </TabPanel>
        <TabPanel value="all" className="pt-4">
          <AllSubmitted />
        </TabPanel>
      </Tabs>
    </section>
  );
}

/** Every application the automation sent, archived ones included, newest first. */
function AllSubmitted() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const params = {
    offset,
    limit: LIMIT,
    submittedVia: 'AUTOMATION' as const,
    archive: 'all' as const,
  };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['applications', params],
    queryFn: ({ signal }) => fetchApplicationsPage(queryClient, params, signal),
    placeholderData: keepPreviousData,
  });
  const nextOffset = data?.metadata.nextOffset ?? null;
  return (
    <ApplicationsTable
      applications={error ? [] : (data?.items ?? [])}
      loading={isLoading}
      empty={
        error ? (
          <SectionError
            className="my-4"
            title="Could not load the applications your automation sent"
            onRetry={() => void refetch()}
          />
        ) : (
          <EmptyState icon={SendIcon} title="Nothing sent yet">
            Applications appear here as your automation sends them.
          </EmptyState>
        )
      }
      footer={
        (offset > 0 || nextOffset !== null) && (
          <Pagination
            offset={offset}
            limit={LIMIT}
            hasNext={!isFetching && nextOffset !== null}
            onPrevious={() => setOffset(Math.max(0, offset - LIMIT))}
            onNext={() => nextOffset !== null && setOffset(nextOffset)}
          />
        )
      }
    />
  );
}
