import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApplicationsPage } from '../../lib/applicationCache';
import { Pagination } from '../ui/pagination';
import { PendingSubmissionsSection } from './PendingSubmissionsSection';

const PAGE_SIZE = 20;

/**
 * Automation submissions that wait for the user, with the applications they can be linked to.
 * The applications come a page at a time; the pager shows only when there is more than one page.
 */
export function SubmissionReview() {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const { data, error, isFetching } = useQuery({
    queryKey: ['applications', { offset, limit: PAGE_SIZE }],
    // Same cache key as the applications page, so use the same revision-guarded fetch.
    queryFn: ({ signal }) =>
      fetchApplicationsPage(queryClient, { offset, limit: PAGE_SIZE }, signal),
    placeholderData: keepPreviousData,
  });
  const nextOffset = data?.metadata.nextOffset ?? null;

  return (
    <>
      {error && <p role="alert">Could not load applications: {error.message}</p>}
      {(offset > 0 || nextOffset !== null) && (
        <section aria-label="Applications for matching">
          <p className="text-sm">Browse applications available in the review list below.</p>
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            hasNext={!isFetching && nextOffset !== null}
            onPrevious={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            onNext={() => nextOffset !== null && setOffset(nextOffset)}
          />
        </section>
      )}
      {data && <PendingSubmissionsSection applications={data.items} />}
    </>
  );
}
