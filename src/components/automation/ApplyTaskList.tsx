import { useId, useState } from 'react';
import { ChevronRightIcon, SendIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApplyTask, ApplyTaskSummary } from '../../contracts/submission';
import { fetchApplicationsPage } from '../../lib/applicationCache';
import {
  duration,
  planItemCount,
  plannedTotal,
  siteName,
  taskMinutes,
  taskName,
} from '../../lib/applyTask';
import { cn } from '../../lib/utils';
import { ApplicationsTable } from '../applications/ApplicationsTable';
import { Collapse } from '../ui/collapse';
import { EmptyState } from '../ui/empty-state';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { SkeletonRows } from '../ui/skeleton';

const TASKS_PER_PAGE = 10;
const APPS_PER_PAGE = 20;
const EARLIER = 'none';

/**
 * The applications NorthList Apply sent, one row per run (owner, 25 Nov 2026; mock
 * `APPLY-TASKS-mock/app.html`). A run is named by when it started; it opens to its applications.
 * Applications sent before runs were reported sit in one last group, "Earlier".
 */
export function ApplyTaskList() {
  const [offset, setOffset] = useState(0);
  // The newest run starts open; afterwards the user decides.
  const [open, setOpen] = useState<Set<string> | null>(null);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['apply-tasks', offset],
    queryFn: ({ signal }) => api.getApplyTasks({ offset, limit: TASKS_PER_PAGE }, { signal }),
    placeholderData: keepPreviousData,
  });

  if (isLoading) return <SkeletonRows rows={4} label="Loading tasks" />;
  if (error || !data)
    return (
      <SectionError
        className="my-4"
        title="Could not load the tasks your automation ran"
        onRetry={() => void refetch()}
      />
    );

  const { items: tasks, summary, metadata } = data;
  const lastPage = metadata.nextOffset === null;
  const showEarlier = lastPage && summary.earlier > 0;
  if (!tasks.length && !showEarlier)
    return (
      <EmptyState icon={SendIcon} title="Nothing sent yet">
        Applications appear here as your automation sends them, one group per run.
      </EmptyState>
    );

  const firstOpen = offset === 0 ? (tasks[0]?.id ?? EARLIER) : null;
  const isOpen = (key: string) => (open ? open.has(key) : key === firstOpen);
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current ?? (firstOpen ? [firstOpen] : []));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {summary.tasks > 0 && <Summary summary={summary} />}
      <ul className="border-t border-border-subtle" aria-label="Tasks">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            open={isOpen(task.id)}
            onToggle={() => toggle(task.id)}
          />
        ))}
        {showEarlier && (
          <TaskGroup
            name="Earlier"
            open={isOpen(EARLIER)}
            onToggle={() => toggle(EARLIER)}
            right={<span className="font-semibold tabular-nums">{summary.earlier} sent</span>}
            meta={<span className="text-text-tertiary">Sent before tasks were added</span>}
            applyTask={EARLIER}
          />
        )}
      </ul>
      {(offset > 0 || !lastPage) && (
        <Pagination
          offset={offset}
          limit={TASKS_PER_PAGE}
          hasNext={!isFetching && !lastPage}
          onPrevious={() => setOffset(Math.max(0, offset - TASKS_PER_PAGE))}
          onNext={() => metadata.nextOffset !== null && setOffset(metadata.nextOffset)}
        />
      )}
    </div>
  );
}

function Summary({ summary }: { summary: ApplyTaskSummary }) {
  const each = summary.sent && summary.minutes ? Math.round(summary.minutes / summary.sent) : null;
  const tiles = [
    [String(summary.tasks), summary.tasks === 1 ? 'task' : 'tasks'],
    [String(summary.sent), 'applications sent'],
    ...(summary.minutes ? [[duration(summary.minutes), 'time taken in all']] : []),
    ...(each ? [[`about ${Math.max(1, each)} min`, 'per application']] : []),
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-3 md:flex md:gap-8">
      {tiles.map(([value, label]) => (
        <div key={label} className="flex flex-col-reverse">
          <dt className="text-xs text-text-tertiary">{label}</dt>
          <dd className="text-xl leading-7 font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TaskRow({
  task,
  open,
  onToggle,
}: {
  task: ApplyTask;
  open: boolean;
  onToggle: () => void;
}) {
  const planned = plannedTotal(task.plan);
  const minutes = taskMinutes(task);
  return (
    <TaskGroup
      name={taskName(task)}
      open={open}
      onToggle={onToggle}
      applyTask={task.id}
      right={
        <>
          <span className="font-semibold tabular-nums">
            {planned ? `${task.sent} of ${planned} sent` : `${task.sent} sent`}
          </span>
          {minutes !== null && (
            <span className="text-xs text-text-tertiary tabular-nums">{duration(minutes)}</span>
          )}
        </>
      }
      meta={
        <>
          {task.plan.map((item) => (
            <span key={item.site}>
              {siteName(item.site)}{' '}
              <span className="font-medium text-text-primary tabular-nums">
                {planItemCount(item)}
              </span>
            </span>
          ))}
          {task.notSent > 0 && (
            <Link
              to="/automation"
              search={{ tab: 'not-submitted' }}
              className="relative z-10 text-text-tertiary underline decoration-border-default underline-offset-3 hover:text-text-primary"
            >
              {task.notSent} not sent
            </Link>
          )}
        </>
      }
      progress={planned ? Math.min(1, task.sent / planned) : null}
    />
  );
}

/** One group: a row that opens to its applications. */
function TaskGroup({
  name,
  open,
  onToggle,
  right,
  meta,
  progress = null,
  applyTask,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  right: React.ReactNode;
  meta: React.ReactNode;
  progress?: number | null;
  applyTask: string;
}) {
  const panelId = useId();
  return (
    <li className="border-b border-border-subtle">
      <div className="relative grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-[10px] px-2 py-3.5 transition-colors duration-70 hover:bg-layer-hover">
        <ChevronRightIcon
          size={16}
          aria-hidden="true"
          className={cn(
            'text-text-tertiary transition-transform duration-240 ease-standard',
            open && 'rotate-90',
          )}
        />
        {/* The whole row opens the group; the not-sent link sits above it. */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="min-w-0 cursor-pointer text-left font-semibold outline-none after:absolute after:inset-0 after:rounded-[10px] focus-visible:after:outline-2 focus-visible:after:outline-border-focus"
        >
          {name}
        </button>
        <span className="row-span-2 flex flex-col items-end gap-1 text-right">{right}</span>
        <span className="col-start-2 flex flex-wrap gap-x-3.5 gap-y-0.5 text-xs text-text-secondary">
          {meta}
        </span>
        {progress !== null && (
          <span
            aria-hidden="true"
            className="col-span-2 col-start-2 mt-1.5 h-[3px] overflow-hidden rounded-full bg-chart-track md:max-w-90"
          >
            <span
              className="block h-full rounded-full bg-chart-1"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </span>
        )}
      </div>
      <Collapse open={open} id={panelId}>
        {open && <TaskApplications applyTask={applyTask} />}
      </Collapse>
    </li>
  );
}

/** One run's applications, in the same table as the rest of the app. */
function TaskApplications({ applyTask }: { applyTask: string }) {
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const params = {
    offset,
    limit: APPS_PER_PAGE,
    submittedVia: 'AUTOMATION' as const,
    archive: 'all' as const,
    applyTask,
  };
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['applications', params],
    queryFn: ({ signal }) => fetchApplicationsPage(queryClient, params, signal),
    placeholderData: keepPreviousData,
  });
  const nextOffset = data?.metadata.nextOffset ?? null;
  return (
    <div className="pb-3.5 md:pl-7">
      <ApplicationsTable
        applications={error ? [] : (data?.items ?? [])}
        loading={isLoading}
        empty={
          error ? (
            <SectionError
              className="my-4"
              title="Could not load this task’s applications"
              onRetry={() => void refetch()}
            />
          ) : (
            <p className="py-4 text-sm text-text-secondary">
              None of this task’s applications is in your list yet. Any that need a match wait under
              “Waiting for a match”.
            </p>
          )
        }
        footer={
          (offset > 0 || nextOffset !== null) && (
            <Pagination
              offset={offset}
              limit={APPS_PER_PAGE}
              hasNext={!isFetching && nextOffset !== null}
              onPrevious={() => setOffset(Math.max(0, offset - APPS_PER_PAGE))}
              onNext={() => nextOffset !== null && setOffset(nextOffset)}
            />
          )
        }
      />
    </div>
  );
}
