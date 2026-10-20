import { useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Checkmark, ChevronRight } from '@carbon/icons-react';
import { api } from '../../api/client';
import type { ApplicationActionListItem } from '../../contracts/application';
import { dateAndTime, stepSource, stepText } from '../../lib/applicationDetail';
import { deadlineLabel } from '../../lib/deadline';
import { repliedLine } from '../../lib/mails';
import { dueIn } from '../../lib/mailThread';
import { cn } from '../../lib/utils';
import { FollowUpEditor, SnoozeControl } from '../FollowThrough';
import type { DialogHandle } from '../../lib/dialogs';
import { TodoState } from '../mails/TodoState';
import { Button } from '../ui/button';
import { OverflowMenu, type MenuAction } from '../ui/menu';
import { InlineNotification } from '../ui/notification';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { showToast } from '../ui/toast';

const PAGE = 20;

/** Completes, dismisses or reopens one step, and reads every list that shows it again. */
function useStepUpdate(action: ApplicationActionListItem) {
  const queryClient = useQueryClient();
  const refresh = () => {
    for (const key of ['application-actions', 'applications', 'actions', 'workspace'])
      void queryClient.invalidateQueries({ queryKey: [key] });
    void queryClient.invalidateQueries({ queryKey: ['application', action.applicationId] });
  };
  return useMutation({
    retry: false,
    mutationFn: ({
      status,
      revision,
    }: {
      status: 'PENDING' | 'COMPLETED' | 'DISMISSED';
      revision: number;
    }) => api.updateAction(action.id, { status, expectedActionRevision: revision }),
    onSettled: refresh,
  });
}

function StepMeta({
  action,
  source,
}: {
  action: ApplicationActionListItem;
  source: ReturnType<typeof stepSource>;
}) {
  const parts: React.ReactNode[] = [];
  // Once the user replied, when they replied matters more than the due date.
  if (action.deadline && !action.repliedAt)
    parts.push(
      <span key="due">
        Due {deadlineLabel(action)} · {dueIn(String(action.deadline), new Date())}
      </span>,
    );
  if (action.snoozedUntil)
    parts.push(
      <span key="snooze">
        Snoozed until {dateAndTime(action.snoozedUntil)}. The due date stays.
      </span>,
    );
  if (source)
    parts.push(
      source.mailId ? (
        <Link key="source" to="/mails/$key" params={{ key: source.mailId }} className="text-link">
          {source.text}
        </Link>
      ) : (
        <span key="source">{source.text}</span>
      ),
    );
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tracking-[0.32px] text-text-secondary">
      {action.repliedAt && (
        <>
          <TodoState state="REPLIED" />
          <span>{repliedLine(action.repliedAt)}</span>
        </>
      )}
      {parts.map((part, index) => (
        <span key={index} className="flex items-center gap-2">
          {(index > 0 || action.repliedAt) && <span aria-hidden="true">·</span>}
          {part}
        </span>
      ))}
    </span>
  );
}

/** One open step: what to do, when, where it came from; Complete, and more in "…". */
function StepRow({
  action,
  archived,
  source,
}: {
  action: ApplicationActionListItem;
  archived: boolean;
  source: ReturnType<typeof stepSource>;
}) {
  const update = useStepUpdate(action);
  const snooze = useRef<DialogHandle>(null);
  const edit = useRef<DialogHandle>(null);
  const more = useRef<HTMLButtonElement>(null);
  const text = stepText(action);
  const change = (status: 'COMPLETED' | 'DISMISSED') =>
    update.mutate(
      { status, revision: action.actionRevision },
      {
        onSuccess: (saved) =>
          showToast(`${status === 'COMPLETED' ? 'Done' : 'Dismissed'}: ${text}`, {
            undo: () => update.mutate({ status: 'PENDING', revision: saved.actionRevision }),
          }),
      },
    );
  const actions: MenuAction[] = [
    {
      label: action.snoozedUntil ? 'Change snooze…' : 'Snooze…',
      onSelect: () => snooze.current?.open(),
    },
    ...(action.origin === 'USER' ? [{ label: 'Edit…', onSelect: () => edit.current?.open() }] : []),
    { label: 'Dismiss', onSelect: () => change('DISMISSED') },
  ];

  return (
    <li className="flex animate-fade-in flex-col gap-2 border-t border-border-subtle py-3.5 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-x-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="break-words">{text}</span>
        <StepMeta action={action} source={source} />
      </div>
      {!archived && (
        <div className="-ml-3 flex items-center gap-1 sm:ml-0">
          <Button
            variant="ghost"
            size="sm"
            disabled={update.isPending}
            onClick={() => change('COMPLETED')}
          >
            <Checkmark size={16} aria-hidden="true" />
            Complete
          </Button>
          <OverflowMenu label={`More for ${text}`} actions={actions} triggerRef={more} />
          <SnoozeControl action={action} trigger={false} ref={snooze} returnFocus={more} />
          {action.origin === 'USER' && (
            <FollowUpEditor
              applicationId={action.applicationId}
              action={action}
              trigger={false}
              ref={edit}
              returnFocus={more}
            />
          )}
        </div>
      )}
      {update.isError && (
        <InlineNotification kind="error" className="col-span-2">
          We could not confirm this change. The list was read again: check the step before you try
          once more.
        </InlineNotification>
      )}
    </li>
  );
}

const DONE_LABEL: Record<string, string> = { COMPLETED: 'Done', DISMISSED: 'Dismissed' };

/** Finished steps, folded under "Done (3)". */
function DoneSteps({ actions }: { actions: ApplicationActionListItem[] }) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;
  return (
    <div className="border-t border-border-subtle">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex min-h-10 w-full cursor-pointer items-center gap-2 pt-3 text-sm text-text-secondary transition-colors duration-70 ease-standard hover:text-text-primary"
      >
        <ChevronRight
          size={16}
          aria-hidden="true"
          className={cn('transition-transform duration-150 ease-standard', open && 'rotate-90')}
        />
        Done ({actions.length})
      </button>
      {open && (
        <ul className="animate-open">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex items-center justify-between gap-4 py-2.5 text-sm text-text-secondary"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Checkmark size={16} aria-hidden="true" className="shrink-0" />
                <span className="break-words">{stepText(action)}</span>
              </span>
              <span className="shrink-0 text-xs">{DONE_LABEL[action.status] ?? 'Closed'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The application's to-dos: open ones first, each with Complete and a "…" menu; finished ones
 * folded below.
 */
export function NextSteps({
  applicationId,
  archived,
  senders,
}: {
  applicationId: string;
  archived: boolean;
  /** Who wrote each mail the page knows, to say where a step came from. */
  senders: ReadonlyMap<string, string>;
}) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ['application-actions', applicationId, offset],
    queryFn: ({ signal }) => api.getApplicationActions(applicationId, { offset }, { signal }),
  });
  const items = query.data?.items ?? [];
  const open = items.filter((action) => action.status === 'PENDING');
  const done = items.filter((action) => action.status !== 'PENDING');
  const nextOffset = query.data?.metadata.nextOffset ?? null;

  return (
    <section aria-labelledby="steps-heading" className="flex flex-col bg-surface px-6 py-5">
      <div className="flex items-baseline gap-3 pb-3">
        <h2 id="steps-heading" className="text-xl leading-7">
          Next steps
        </h2>
        {query.data && <span className="text-xs text-text-secondary">{open.length} open</span>}
      </div>
      {query.isLoading && <SkeletonList rows={2} label="Loading next steps" />}
      {query.isError && (
        <SectionError title="Could not load next steps" onRetry={() => void query.refetch()} />
      )}
      {query.data && open.length === 0 && (
        <p className="border-t border-border-subtle py-3.5 text-sm text-text-secondary">
          {offset > 0 ? 'No open steps on this page.' : 'Nothing to do now.'}
        </p>
      )}
      {open.length > 0 && (
        <ul>
          {open.map((action) => (
            <StepRow
              key={action.id}
              action={action}
              archived={archived}
              source={stepSource(action, senders)}
            />
          ))}
        </ul>
      )}
      <DoneSteps actions={done} />
      {(offset > 0 || nextOffset !== null) && (
        <Pagination
          offset={offset}
          limit={PAGE}
          hasNext={nextOffset !== null}
          onPrevious={() => setOffset(Math.max(0, offset - PAGE))}
          onNext={() => nextOffset !== null && setOffset(nextOffset)}
        />
      )}
    </section>
  );
}
