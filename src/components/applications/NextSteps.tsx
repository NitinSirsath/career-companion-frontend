import { useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckIcon, ChevronRightIcon, ClockIcon, MailIcon, XIcon } from 'lucide-react';
import { api } from '../../api/client';
import type { ApplicationActionListItem } from '../../contracts/application';
import { dateAndTime, stepSource, stepText } from '../../lib/applicationDetail';
import { deadlineLabel, deadlineOverdue } from '../../lib/deadline';
import { CLOSED_REASON_LABEL, closesByHand, repliedLine } from '../../lib/mails';
import { dueIn } from '../../lib/mailThread';
import { cn } from '../../lib/utils';
import { SnoozeControl } from '../FollowThrough';
import type { DialogHandle } from '../../lib/dialogs';
import { ChevronRightIcon as ChevronIcon, CircleCheckIcon as DoneIcon } from 'lucide-react';
import { useIsPhone } from '../layout/useIsPhone';
import { TodoState } from '../mails/TodoState';
import { PHONE_ROW, PhoneGroupSection as PhoneSection } from '../phone/PhoneList';
import { Sheet, SheetAction, SheetBody, SheetGroup } from '../ui/sheet';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';
import { OverflowMenu, type MenuAction } from '../ui/menu';
import { InlineNotification } from '../ui/notification';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { showToast } from '../ui/toast';
import { isOfflineError } from '../../lib/offline';

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
  plain = false,
}: {
  action: ApplicationActionListItem;
  source: ReturnType<typeof stepSource>;
  /** No link, for a row that is itself a button (phones). */
  plain?: boolean;
}) {
  const parts: React.ReactNode[] = [];
  // Once the user replied, when they replied matters more than the due date.
  if (action.deadline && !action.repliedAt) {
    const late = deadlineOverdue(action, new Date());
    parts.push(
      <span key="due" className={cn(late && 'text-danger-text')}>
        {late ? 'Past due' : 'Due'} {deadlineLabel(action)} ·{' '}
        {dueIn(String(action.deadline), new Date())}
      </span>,
    );
  }
  if (action.snoozedUntil)
    parts.push(
      <span key="snooze">
        Snoozed until {dateAndTime(action.snoozedUntil)}. The due date stays.
      </span>,
    );
  if (source)
    parts.push(
      source.mailId && !plain ? (
        <Link key="source" to="/mails/$key" params={{ key: source.mailId }} className="text-link">
          {source.text}
        </Link>
      ) : (
        <span key="source">{source.text}</span>
      ),
    );
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
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

/** Changes a step and says so, with Undo. */
function useStepChange(action: ApplicationActionListItem) {
  const update = useStepUpdate(action);
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
  return { update, change };
}

/**
 * One open step: what to do, when, where it came from, and more in "…". Only the user's own
 * steps have "Complete"; a step from a mail closes when a reply or a newer mail settles it, and
 * one done outside mail has "I did this" in "…" (owner, 24 Oct 2026).
 */
function StepRow({
  action,
  archived,
  source,
}: {
  action: ApplicationActionListItem;
  archived: boolean;
  source: ReturnType<typeof stepSource>;
}) {
  const { update, change } = useStepChange(action);
  const snooze = useRef<DialogHandle>(null);
  const more = useRef<HTMLButtonElement>(null);
  const text = stepText(action);
  const own = action.origin === 'USER' || !action.emailId;
  const actions: MenuAction[] = [
    ...(!own && closesByHand(action)
      ? [{ label: 'I did this', onSelect: () => change('COMPLETED') }]
      : []),
    {
      label: action.snoozedUntil ? 'Change snooze…' : 'Snooze…',
      onSelect: () => snooze.current?.open(),
    },
    { label: 'Dismiss', onSelect: () => change('DISMISSED') },
  ];

  return (
    // Phones: the "…" sits at the step's top right and "Complete" under its text (owner, 7 Nov 2026).
    <li className="grid animate-fade-in grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1 border-t border-border-subtle py-3.5 sm:items-center sm:gap-x-4 sm:gap-y-2">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="break-words">{text}</span>
        <StepMeta action={action} source={source} />
      </div>
      {!archived && (
        <div className="flex items-center gap-1 max-sm:contents">
          {own && (
            <Button
              variant="ghost"
              size="sm"
              className="max-sm:col-start-1 max-sm:row-start-2 max-sm:-ml-3 max-sm:justify-self-start"
              disabled={update.isPending}
              onClick={() => change('COMPLETED')}
            >
              <CheckIcon size={16} aria-hidden="true" />
              Complete
            </Button>
          )}
          <OverflowMenu
            label={`More for ${text}`}
            actions={actions}
            triggerRef={more}
            className="max-sm:col-start-2 max-sm:row-start-1 max-sm:-mt-1.5 max-sm:-mr-2"
          />
          <SnoozeControl action={action} trigger={false} ref={snooze} returnFocus={more} />
        </div>
      )}
      {/* Offline the toast says that nothing changed. */}
      {update.isError && !isOfflineError(update.error) && (
        <InlineNotification kind="error" className="col-span-2">
          We could not confirm this change. The list was read again: check the step before you try
          once more.
        </InlineNotification>
      )}
    </li>
  );
}

/**
 * One open step on a phone (owner, 12 Nov 2026): a row with what to do, when and where from; a tap
 * opens a sheet with all of it and what can be done: Complete (own steps), "I did this", Snooze,
 * Dismiss, and the mail it came from.
 */
/** A step's sheet actions on a phone: complete it, snooze it, dismiss it, or open its mail. */
function StepSheetActions({
  own,
  action,
  busy,
  onPick,
  onSnooze,
  onMail,
}: {
  own: boolean;
  action: ApplicationActionListItem;
  busy: boolean;
  onPick: (status: 'COMPLETED' | 'DISMISSED') => void;
  onSnooze: () => void;
  onMail?: () => void;
}) {
  const done = own || closesByHand(action);
  return (
    <SheetGroup>
      {done && (
        <SheetAction
          icon={<DoneIcon size={22} />}
          disabled={busy}
          onClick={() => onPick('COMPLETED')}
        >
          {own ? 'Complete' : 'I did this'}
        </SheetAction>
      )}
      <SheetAction icon={<ClockIcon size={22} />} onClick={onSnooze}>
        {action.snoozedUntil ? 'Change snooze…' : 'Snooze…'}
      </SheetAction>
      <SheetAction icon={<XIcon size={22} />} disabled={busy} onClick={() => onPick('DISMISSED')}>
        Dismiss
      </SheetAction>
      {onMail && (
        <SheetAction icon={<MailIcon size={22} />} onClick={onMail}>
          Open the mail
        </SheetAction>
      )}
    </SheetGroup>
  );
}

function PhoneStepRow({
  action,
  archived,
  source,
}: {
  action: ApplicationActionListItem;
  archived: boolean;
  source: ReturnType<typeof stepSource>;
}) {
  const { update, change } = useStepChange(action);
  const [open, setOpen] = useState(false);
  const snooze = useRef<DialogHandle>(null);
  const navigate = useNavigate();
  const text = stepText(action);
  const own = action.origin === 'USER' || !action.emailId;
  const body = (
    <span className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[15px] leading-[21px] break-words">{text}</span>
      <StepMeta action={action} source={source} plain />
    </span>
  );
  if (archived) return <div className={PHONE_ROW}>{body}</div>;
  const pick = (status: 'COMPLETED' | 'DISMISSED') => {
    setOpen(false);
    change(status);
  };
  const openSnooze = () => {
    setOpen(false);
    snooze.current?.open();
  };
  const openMail = () => {
    setOpen(false);
    if (source?.mailId) void navigate({ to: '/mails/$key', params: { key: source.mailId } });
  };
  return (
    <>
      <button type="button" className={PHONE_ROW} onClick={() => setOpen(true)}>
        {body}
        <ChevronIcon size={18} className="shrink-0 text-text-tertiary" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Next step">
        <SheetBody>
          <p className="text-[17px] leading-6 break-words">{text}</p>
          <StepMeta action={action} source={source} />
        </SheetBody>
        <StepSheetActions
          own={own}
          action={action}
          busy={update.isPending}
          onPick={pick}
          onSnooze={openSnooze}
          onMail={source?.mailId ? openMail : undefined}
        />
      </Sheet>
      <SnoozeControl action={action} trigger={false} ref={snooze} />
      {update.isError && !isOfflineError(update.error) && (
        <div className="px-3.5 py-2">
          <InlineNotification kind="error">
            We could not confirm this change. The list was read again: check the step before you try
            once more.
          </InlineNotification>
        </div>
      )}
    </>
  );
}

/** Finished steps on a phone: a "Done (3)" row that opens them in place. */
function PhoneDoneSteps({ actions }: { actions: ApplicationActionListItem[] }) {
  const [open, setOpen] = useState(false);
  if (actions.length === 0) return null;
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        className={PHONE_ROW}
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1 text-[15px]">Done ({actions.length})</span>
        <ChevronIcon
          size={18}
          className={cn(
            'shrink-0 text-text-tertiary transition-transform duration-150 ease-standard',
            open && 'rotate-90',
          )}
        />
      </button>
      {open &&
        actions.map((action) => (
          <div key={action.id} className={cn(PHONE_ROW, 'text-sm text-text-secondary')}>
            <span className="flex-1 break-words line-through decoration-text-tertiary">
              {stepText(action)}
            </span>
            <span className="shrink-0 text-xs">{doneLabel(action)}</span>
          </div>
        ))}
    </>
  );
}

const DONE_LABEL: Record<string, string> = { COMPLETED: 'Done', DISMISSED: 'Dismissed' };
/** Why a finished step closed, when something closed it; else Done or Dismissed. */
const doneLabel = (action: ApplicationActionListItem) =>
  (action.closedReason && CLOSED_REASON_LABEL[action.closedReason]) ??
  DONE_LABEL[action.status] ??
  'Closed';

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
        <ChevronRightIcon
          size={16}
          aria-hidden="true"
          className={cn('transition-transform duration-150 ease-standard', open && 'rotate-90')}
        />
        Done ({actions.length})
      </button>
      <Collapse open={open}>
        <ul>
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex items-center justify-between gap-4 py-2.5 text-sm text-text-secondary"
            >
              <span className="flex min-w-0 items-center gap-2">
                <CheckIcon size={16} aria-hidden="true" className="shrink-0" />
                <span className="break-words">{stepText(action)}</span>
              </span>
              <span className="shrink-0 text-xs">{doneLabel(action)}</span>
            </li>
          ))}
        </ul>
      </Collapse>
    </div>
  );
}

/** The next steps on a phone, as one grouped list: open steps, then "Done (3)". */
function PhoneNextSteps({ applicationId, archived, senders }: NextStepsProps) {
  const [offset, onOffset] = useState(0);
  const query = useQuery({
    queryKey: ['application-actions', applicationId, offset],
    queryFn: ({ signal }) => api.getApplicationActions(applicationId, { offset }, { signal }),
  });
  const items = query.data?.items ?? [];
  const open = items.filter((action) => action.status === 'PENDING');
  const done = items.filter((action) => action.status !== 'PENDING');
  const nextOffset = query.data?.metadata.nextOffset ?? null;
  const note = open.some((action) => action.emailId)
    ? 'Steps from mails close by themselves when your reply or a newer mail settles them. Setting the application to Rejected or Closed closes them too.'
    : null;
  return (
    <PhoneSection title="Next steps" count={query.data && `${open.length} open`} note={note}>
      {query.isLoading && <SkeletonList rows={2} label="Loading next steps" />}
      {query.isError && (
        <SectionError title="Could not load next steps" onRetry={() => void query.refetch()} />
      )}
      {query.data && open.length === 0 && (
        <p className={cn(PHONE_ROW, 'text-sm text-text-secondary')}>
          {offset > 0 ? 'No open steps on this page.' : 'Nothing to do now.'}
        </p>
      )}
      {open.map((action) => (
        <PhoneStepRow
          key={action.id}
          action={action}
          archived={archived}
          source={stepSource(action, senders)}
        />
      ))}
      <PhoneDoneSteps actions={done} />
      {(offset > 0 || nextOffset !== null) && (
        <Pagination
          offset={offset}
          limit={PAGE}
          hasNext={nextOffset !== null}
          onPrevious={() => onOffset(Math.max(0, offset - PAGE))}
          onNext={() => nextOffset !== null && onOffset(nextOffset)}
        />
      )}
    </PhoneSection>
  );
}

/**
 * The application's to-dos: open ones first, each with Complete and a "…" menu; finished ones
 * folded below.
 */
function PanelNextSteps({
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
    <section aria-labelledby="steps-heading" className="flex flex-col panel px-6 py-5">
      <div className="flex items-baseline gap-3 pb-3">
        <h2 id="steps-heading" className="text-xl leading-7 font-medium">
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
      {open.some((action) => action.emailId) && (
        <p className="border-t border-border-subtle py-3 text-xs text-text-secondary">
          Steps from mails close by themselves when your reply or a newer mail settles them. Setting
          the application to Rejected or Closed closes them too.
        </p>
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

interface NextStepsProps {
  applicationId: string;
  archived: boolean;
  /** Who wrote each mail the page knows, to say where a step came from. */
  senders: ReadonlyMap<string, string>;
}

/** The application's next steps: a grouped list on phones (owner, 12 Nov 2026), else a card. */
export function NextSteps(props: NextStepsProps) {
  const phone = useIsPhone();
  return phone ? <PhoneNextSteps {...props} /> : <PanelNextSteps {...props} />;
}
