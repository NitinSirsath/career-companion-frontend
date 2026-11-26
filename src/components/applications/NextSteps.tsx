import { useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, ChevronRightIcon, ClockIcon, MailIcon, XIcon } from 'lucide-react';
import { api } from '../../api/client';
import type { ApplicationActionListItem } from '../../contracts/application';
import { dateAndTime, stepSource, stepText } from '../../lib/applicationDetail';
import { deadlineLabel, deadlineOverdue, shortDue } from '../../lib/deadline';
import { CLOSED_REASON_LABEL, closesByHand, repliedLine } from '../../lib/mails';
import { dueIn } from '../../lib/mailThread';
import { MISSED } from '../../lib/missed';
import { cn } from '../../lib/utils';
import { SnoozeControl } from '../FollowThrough';
import type { DialogHandle } from '../../lib/dialogs';
import { CircleCheckIcon as DoneIcon } from 'lucide-react';
import { useIsPhone } from '../layout/useIsPhone';
import { TodoState } from '../mails/TodoState';
import { DETAIL_ROW, DetailSection } from './DetailSection';
import { MissedStepRow, PhoneMissedStepRow } from './MissedSteps';
import { useStepChange } from './useStepChange';
import { Ring } from '../ui/ring';
import { Sheet, SheetAction, SheetBody, SheetGroup } from '../ui/sheet';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';
import { OverflowMenu, type MenuAction } from '../ui/menu';
import { InlineNotification } from '../ui/notification';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { isOfflineError } from '../../lib/offline';

const PAGE = 20;

/**
 * A page of steps in the order shown: those that need the user, the missed ones (open, but they
 * left Needs action by themselves and are not counted), then the finished ones.
 */
function sortSteps(items: readonly ApplicationActionListItem[]) {
  const pending = items.filter((action) => action.status === 'PENDING');
  const open = pending.filter((action) => !action.missed);
  const missed = pending.filter((action) => action.missed);
  return {
    open,
    /** Both, in the order shown. */
    shown: [...open, ...missed],
    done: items.filter((action) => action.status !== 'PENDING'),
  };
}

/** The small note under a phone's steps: about its missed step, else how mail steps close. */
function phoneStepsNote(shown: readonly ApplicationActionListItem[]): string | null {
  if (shown.some((action) => action.missed)) return MISSED.stepsNote;
  return shown.some((action) => action.emailId) ? CLOSES_BY_ITSELF : null;
}

const CLOSES_BY_ITSELF =
  'Steps from mails close by themselves when your reply or a newer mail settles them. Setting the application to Rejected or Closed closes them too.';

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
  const body = <PhoneStepLine action={action} text={text} />;
  if (archived)
    return <div className={cn(DETAIL_ROW, 'py-[9px] active:bg-transparent')}>{body}</div>;
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
      <button
        type="button"
        className={cn(DETAIL_ROW, 'cursor-pointer py-[9px]')}
        onClick={() => setOpen(true)}
      >
        {body}
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
        <div className="px-[18px] py-2">
          <InlineNotification kind="error">
            We could not confirm this change. The list was read again: check the step before you try
            once more.
          </InlineNotification>
        </div>
      )}
    </>
  );
}

/** One open step's row on a phone: the empty ring, what to do, and when it is due. */
function PhoneStepLine({ action, text }: { action: ApplicationActionListItem; text: string }) {
  const now = new Date();
  const late = !action.repliedAt && deadlineOverdue(action, now);
  let when = '';
  if (action.repliedAt) when = 'You replied';
  else if (action.snoozedUntil) when = 'Snoozed';
  else if (action.deadline) when = shortDue(action, now);
  return (
    <>
      <Ring kind="todo" size={17} />
      <span className="min-w-0 flex-1 text-[15px] leading-[21px] break-words">{text}</span>
      {when && (
        <span
          className={cn(
            'shrink-0 text-phone-sub whitespace-nowrap text-text-secondary',
            late && 'text-late',
          )}
        >
          {when}
        </span>
      )}
    </>
  );
}

/** Finished steps on a phone, under the open ones: the green tick, struck through (mock screen 6). */
function PhoneDoneSteps({ actions }: { actions: ApplicationActionListItem[] }) {
  return actions.map((action) => (
    <div key={action.id} className={cn(DETAIL_ROW, 'py-[9px] active:bg-transparent')}>
      <Ring kind="offer" size={17} />
      <span className="min-w-0 flex-1 text-[15px] leading-[21px] break-words text-text-secondary line-through">
        {stepText(action)}
      </span>
      <span className="shrink-0 text-phone-sub text-text-secondary">{doneLabel(action)}</span>
    </div>
  ));
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

/**
 * The to-dos on a phone (mock screen 6): open ones with their due date, the missed ones, then the
 * finished ones.
 */
function PhoneNextSteps({ applicationId, archived, senders }: NextStepsProps) {
  const [offset, onOffset] = useState(0);
  const query = useQuery({
    queryKey: ['application-actions', applicationId, offset],
    queryFn: ({ signal }) => api.getApplicationActions(applicationId, { offset }, { signal }),
  });
  const { open, shown, done } = sortSteps(query.data?.items ?? []);
  const nextOffset = query.data?.metadata.nextOffset ?? null;
  return (
    <DetailSection title="To do" count={query.data && open.length} note={phoneStepsNote(shown)}>
      {query.isLoading && <SkeletonList rows={2} label="Loading next steps" />}
      {query.isError && (
        <SectionError title="Could not load next steps" onRetry={() => void query.refetch()} />
      )}
      {query.data && shown.length === 0 && (
        <p className="px-[18px] py-[9px] text-[15px] text-text-secondary">
          {offset > 0 ? 'No open steps on this page.' : 'Nothing to do now.'}
        </p>
      )}
      {shown.map((action) => {
        const Row = action.missed ? PhoneMissedStepRow : PhoneStepRow;
        return (
          <Row
            key={action.id}
            action={action}
            archived={archived}
            source={stepSource(action, senders)}
          />
        );
      })}
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
    </DetailSection>
  );
}

/**
 * The application's to-dos: open ones first, each with Complete and a "…" menu; then the missed
 * ones, dim, with "Still open"; finished ones folded below.
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
  const { open, shown, done } = sortSteps(query.data?.items ?? []);
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
      {query.data && shown.length === 0 && (
        <p className="border-t border-border-subtle py-3.5 text-sm text-text-secondary">
          {offset > 0 ? 'No open steps on this page.' : 'Nothing to do now.'}
        </p>
      )}
      {shown.length > 0 && (
        <ul>
          {shown.map((action) => {
            const Row = action.missed ? MissedStepRow : StepRow;
            return (
              <Row
                key={action.id}
                action={action}
                archived={archived}
                source={stepSource(action, senders)}
              />
            );
          })}
        </ul>
      )}
      {open.some((action) => action.emailId) && (
        <p className="border-t border-border-subtle py-3 text-xs text-text-secondary">
          {CLOSES_BY_ITSELF}
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
