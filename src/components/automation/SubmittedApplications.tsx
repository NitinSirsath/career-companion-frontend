import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApplicationsPage } from '../../lib/applicationCache';
import { ApplicationsTable } from '../applications/ApplicationsTable';
import { EmptyState } from '../ui/empty-state';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';

const LIMIT = 20;

/** Every application the automation sent, archived ones included, newest first. */
export function SubmittedApplications() {
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
    <section aria-labelledby="submitted-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="submitted-title" className="text-base font-semibold">
          Applications your automation sent
        </h2>
        <p className="text-sm text-text-secondary">
          Each one is also in Applications. Open it for the job link and the answers sent.
        </p>
      </div>
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
            <EmptyState title="Nothing sent yet">
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
    </section>
  );
}
