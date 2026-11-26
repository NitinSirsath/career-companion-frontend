import { useState } from 'react';
import { ListTodoIcon } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../../api/client';
import type { NotSubmittedJob } from '../../contracts/submission';
import { platformLabel } from '../../lib/eventLabels';
import { MISSED } from '../../lib/missed';
import { cn } from '../../lib/utils';
import { DataTable } from '../ui/data-table';
import { EmptyState } from '../ui/empty-state';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { Tag } from '../ui/tag';
import { JobLink } from './JobLink';

const LIMIT = 20;

const OUTCOME = {
  SKIPPED: { label: 'Skipped', color: 'outline' },
  NEEDS_USER: { label: 'Needs you', color: 'yellow' },
} as const;

/**
 * A job left for the user more than 7 days ago is "Missed" (owner, 26 Nov 2026): grey, dim, and
 * no longer counted as "Needs you".
 */
const outcomeOf = (job: NotSubmittedJob) =>
  job.missed ? ({ label: MISSED.label, color: 'gray' } as const) : OUTCOME[job.outcome];

const dim = (job: NotSubmittedJob) => (job.missed ? 'opacity-55' : undefined);

// Every field comes from the user's automation and is untrusted: rendered as plain text only.
const COLUMNS: ColumnDef<NotSubmittedJob>[] = [
  {
    id: 'job',
    header: 'Company',
    meta: { count: true },
    cell: ({ row: { original: job } }) => (
      <div className={cn('flex flex-col gap-0.5 break-words', dim(job))}>
        <span className="font-semibold">{job.company}</span>
        <span className="text-xs text-text-secondary">{job.jobTitle}</span>
      </div>
    ),
  },
  {
    id: 'platform',
    header: 'Platform',
    cell: ({ row: { original: job } }) => (
      <span className={cn('flex items-center gap-1', dim(job))}>
        {platformLabel(job.platform)}
        <JobLink url={job.jobUrl} label={`Open the job post for ${job.company} in a new tab`} />
      </span>
    ),
    meta: { phoneLabel: 'Platform' },
  },
  {
    id: 'reason',
    header: 'Reason',
    cell: ({ row: { original: job } }) => (
      <div className={cn('flex flex-col items-start gap-1', dim(job))}>
        <Tag color={outcomeOf(job).color}>{outcomeOf(job).label}</Tag>
        <span className="break-words whitespace-pre-wrap">{job.reason}</span>
      </div>
    ),
    meta: { phoneLabel: 'Reason' },
  },
  {
    id: 'time',
    header: 'Time',
    cell: ({ row: { original: job } }) => (
      <div className={cn('flex flex-col', dim(job))}>
        <span>{format(new Date(job.loggedAt), 'd MMM yyyy')}</span>
        <span className="text-xs text-text-secondary">
          {format(new Date(job.loggedAt), 'h:mm a')}
        </span>
      </div>
    ),
    meta: { phoneLabel: 'Time' },
  },
];

/** The "Not submitted" tab: jobs the automation looked at but did not apply to. */
export function NotSubmittedJobs() {
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['not-submitted-jobs', { offset, limit: LIMIT }],
    queryFn: ({ signal }) => api.getNotSubmittedJobs({ offset, limit: LIMIT }, { signal }),
    placeholderData: keepPreviousData,
  });
  const nextOffset = data?.metadata.nextOffset ?? null;
  return (
    <section aria-labelledby="not-submitted-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="not-submitted-title" className="text-base font-semibold">
          Jobs your automation did not apply to
        </h2>
        <p className="text-sm text-text-secondary">
          Sent at the end of each run, with the reason. They never become applications.
        </p>
      </div>
      <DataTable
        label="Jobs not submitted"
        data={error ? [] : (data?.items ?? [])}
        columns={COLUMNS}
        getRowId={(job) => job.id}
        gridTemplate="minmax(200px,1.6fr) minmax(140px,1fr) minmax(220px,2fr) 112px"
        loading={isLoading}
        empty={
          error ? (
            <SectionError
              className="my-4"
              title="Could not load the jobs not submitted"
              onRetry={() => void refetch()}
            />
          ) : (
            <EmptyState icon={ListTodoIcon} title="Nothing here yet">
              Jobs your automation skips or leaves for you appear here after its run.
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
      {!error && data?.items.some((job) => job.missed) && (
        <p className="text-xs text-text-secondary">{MISSED.applyNote}</p>
      )}
    </section>
  );
}
