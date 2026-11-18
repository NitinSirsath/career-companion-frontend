import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ApplicationEventResponse,
  ListApplicationEventsResponse,
} from '../../contracts/application';
import {
  dateAndTime,
  historyEntry,
  retiredLine,
  type HistoryEntry,
} from '../../lib/applicationDetail';
import { mailDateTime } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { AnalyzedBy } from '../ai/AnalyzedBy';
import { CircleDotIcon, MailIcon, WorkflowIcon } from 'lucide-react';
import { format } from 'date-fns';
import { STATUS_LABEL } from '../../lib/statusLabels';
import { useIsPhone } from '../layout/useIsPhone';
import type { DialogHandle } from '../../lib/dialogs';
import { MatchCorrectionDialog } from '../MatchCorrectionDialog';
import { Button } from '../ui/button';
import { Collapse } from '../ui/collapse';
import { OverflowMenu, type MenuAction } from '../ui/menu';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { DETAIL_ROW, DetailSection } from './DetailSection';
import { Ring } from '../ui/ring';
import { STATUS_RING } from '../../lib/statusTags';
import { Sheet, SheetAction, SheetBody, SheetGroup } from '../ui/sheet';
import { SkeletonList } from '../ui/skeleton';

/** What the automation reported: where it sent the application, when, and what the site said. */
function SubmissionFacts({ event }: { event: ApplicationEventResponse }) {
  const submission = event.sourceSubmission;
  if (!submission) return null;
  return (
    <div className="flex flex-col gap-1 text-xs text-text-secondary">
      <p>
        Sent <time dateTime={submission.submittedAt}>{dateAndTime(submission.submittedAt)}</time>,
        as your automation reported it
      </p>
      {submission.confirmationText && (
        <p className="break-words">
          The site said:{' '}
          <span className="whitespace-pre-wrap text-text-primary">
            {submission.confirmationText}
          </span>
        </p>
      )}
    </div>
  );
}

/** The AI's own note on the mail, folded: it is the AI's reading, not the mail's words. */
function AiNote({ event }: { event: ApplicationEventResponse }) {
  const [open, setOpen] = useState(false);
  if (!event.description && !event.provenance) return null;
  return (
    <div className="flex flex-col">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 self-start"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Hide the AI note' : 'Show the AI note'}
      </Button>
      <Collapse open={open}>
        <AiNoteText event={event} />
      </Collapse>
    </div>
  );
}

/** The note itself, with where the AI read it and which model did. */
function AiNoteText({ event }: { event: ApplicationEventResponse }) {
  return (
    <div className="flex flex-col gap-1 bg-layer-accent px-3 py-2 text-xs text-text-secondary">
      {event.description && <p className="break-words">{event.description}</p>}
      {event.provenance && <p className="break-words italic">{event.provenance}</p>}
      <p>This is the AI's reading, not the mail's own words.</p>
      <AnalyzedBy provider={event.analyzedBy?.provider} model={event.analyzedBy?.model} />
    </div>
  );
}

/** A row's actions: open its mail, or move the mail to another application; none for others. */
function useRowActions(event: ApplicationEventResponse, entry: HistoryEntry) {
  const navigate = useNavigate();
  const correction = useRef<DialogHandle>(null);
  if (!entry.mailId || event.retiredAt || entry.kind !== 'mail') return null;
  const mailId = entry.mailId;
  const actions: MenuAction[] = [
    {
      label: 'Open the mail',
      onSelect: () => void navigate({ to: '/mails/$key', params: { key: mailId } }),
    },
    { label: 'Wrong application?', onSelect: () => correction.current?.open() },
  ];
  const dialog = (
    <MatchCorrectionDialog
      emailId={mailId}
      matchState="MATCHED"
      applicationId={event.applicationId}
      trigger={false}
      ref={correction}
    />
  );
  return { actions, dialog };
}

/** The row's "…": open its mail, or move the mail to another application. */
function RowMenu({ event, entry }: { event: ApplicationEventResponse; entry: HistoryEntry }) {
  const row = useRowActions(event, entry);
  if (!row) return null;
  return (
    <>
      <OverflowMenu label={`More for ${entry.title}`} actions={row.actions} />
      {row.dialog}
    </>
  );
}

const ACTIVITY_ICON = { automation: WorkflowIcon, mail: MailIcon, other: CircleDotIcon };

/**
 * What one Activity row says (mock `PHONE-LINEAR-mock/` screen 6): a status change as its ring and
 * "Moved to **Interview**"; any other row with a small icon and its title.
 */
function ActivityLine({
  event,
  title,
  kind,
}: {
  event: ApplicationEventResponse;
  title: string;
  kind: HistoryEntry['kind'];
}) {
  const moved =
    !event.retiredAt && event.newState && event.newState !== event.oldState ? event.newState : null;
  if (moved)
    return (
      <>
        <Ring kind={STATUS_RING[moved]} size={14} />
        <span className="min-w-0 truncate">
          {event.oldState || moved !== 'APPLIED' ? 'Moved to ' : ''}
          <b className="font-medium text-text-primary">{STATUS_LABEL[moved]}</b>
        </span>
      </>
    );
  const Icon = ACTIVITY_ICON[kind];
  return (
    <>
      <Icon size={14} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 truncate">{title}</span>
    </>
  );
}

/**
 * An Activity row on a phone (owner, 18 Nov 2026): what happened and the day; a tap opens a sheet
 * with the AI note (or what the automation reported) and the row's actions.
 */
function PhoneHistoryRow({ event }: { event: ApplicationEventResponse }) {
  const [open, setOpen] = useState(false);
  const entry = historyEntry(event);
  const retired = retiredLine(event);
  const row = useRowActions(event, entry);
  return (
    <>
      <button
        type="button"
        className={cn(
          DETAIL_ROW,
          'cursor-pointer gap-2.5 py-1.5 text-phone-sub text-text-secondary',
          retired && 'opacity-60',
        )}
        onClick={() => setOpen(true)}
      >
        <ActivityLine event={event} title={entry.title} kind={entry.kind} />
        <span className="ml-auto shrink-0 pl-2 text-[12.5px] text-text-tertiary">
          {format(new Date(event.recordedAt), 'MMM d')}
        </span>
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="History entry">
        <SheetBody>
          <p className="text-base break-words">{entry.title}</p>
          <p className="text-[13px] text-text-secondary">
            <RecordedAt event={event} />
            {entry.detail && <> · {entry.detail}</>}
          </p>
          {retired && <p className="text-xs text-text-secondary">{retired}</p>}
          {entry.kind === 'automation' && <SubmissionFacts event={event} />}
          {entry.kind !== 'automation' && !retired && (event.description || event.provenance) && (
            <AiNoteText event={event} />
          )}
        </SheetBody>
        {!!row?.actions.length && (
          <SheetGroup>
            {row.actions.map((action) => (
              <SheetAction
                key={action.label}
                onClick={() => {
                  setOpen(false);
                  action.onSelect();
                }}
              >
                {action.label}
              </SheetAction>
            ))}
          </SheetGroup>
        )}
      </Sheet>
      {row?.dialog}
    </>
  );
}

/** When the app recorded the row. */
function RecordedAt({ event }: { event: ApplicationEventResponse }) {
  return (
    <time
      dateTime={event.recordedAt}
      title={`Recorded ${dateAndTime(event.recordedAt)}`}
      className="pt-0.5 text-xs whitespace-nowrap text-text-secondary"
    >
      {mailDateTime(event.recordedAt)}
    </time>
  );
}

/** The row's mark on the time line: filled for a mail the AI read. */
function RowDot({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative z-10 mt-1.5 ml-[7px] size-[9px]',
        filled ? 'bg-link' : 'bg-surface shadow-[inset_0_0_0_1px_var(--text-secondary)]',
      )}
    />
  );
}

function HistoryRow({ event }: { event: ApplicationEventResponse }) {
  const entry = historyEntry(event);
  const retired = retiredLine(event);
  const title = entry.mailId ? (
    <Link
      to="/mails/$key"
      params={{ key: entry.mailId }}
      className="break-words text-text-primary hover:underline"
    >
      {entry.title}
    </Link>
  ) : (
    <span className="break-words">{entry.title}</span>
  );
  const time = <RecordedAt event={event} />;
  const more = (
    <>
      {retired && <span className="text-xs">{retired}</span>}
      {entry.kind === 'automation' && <SubmissionFacts event={event} />}
      {entry.kind !== 'automation' && !retired && <AiNote event={event} />}
    </>
  );
  const dot = <RowDot filled={entry.kind === 'mail' && !retired} />;

  return (
    <li
      className={cn(
        'relative grid grid-cols-[24px_minmax(0,1fr)_auto] gap-x-3 py-3',
        retired && 'text-text-secondary',
      )}
    >
      {dot}
      <div className="flex min-w-0 flex-col gap-1">
        {title}
        {entry.detail && <span className="text-xs text-text-secondary">{entry.detail}</span>}
        {more}
      </div>
      <div className="flex items-start gap-1">
        {time}
        <RowMenu event={event} entry={entry} />
      </div>
    </li>
  );
}

/** The history on a phone, as Activity rows that open a sheet (mock screen 6). */
function PhoneHistory({
  query,
  pages,
}: {
  query: UseQueryResult<ListApplicationEventsResponse>;
  pages: ReactNode;
}) {
  const events = query.data?.items;
  return (
    <DetailSection
      title="Activity"
      note="In the order the app recorded it. A mail's own date can be earlier."
    >
      {query.isLoading && <SkeletonList rows={3} label="Loading history" />}
      {query.isError && (
        <SectionError title="Could not load the history" onRetry={() => void query.refetch()} />
      )}
      {events && events.length === 0 && (
        <p className="px-[18px] py-1.5 text-phone-sub text-text-secondary">
          Nothing yet. Mails the AI reads and sends from your automation show here.
        </p>
      )}
      {events?.map((event) => (
        <PhoneHistoryRow key={event.id} event={event} />
      ))}
      {pages}
    </DetailSection>
  );
}

/**
 * What happened to the application, in plain words: each mail the AI read and what it did to the
 * status, and what your automation reported.
 */
export function ApplicationHistory({
  query,
  offset,
  onOffset,
}: {
  query: UseQueryResult<ListApplicationEventsResponse>;
  offset: number;
  onOffset: (offset: number) => void;
}) {
  const events = query.data?.items;
  const phone = useIsPhone();
  const nextOffset = query.data?.metadata.nextOffset ?? null;
  const pages = (offset > 0 || nextOffset !== null) && (
    <Pagination
      offset={offset}
      limit={20}
      hasNext={nextOffset !== null}
      onPrevious={() => onOffset(Math.max(0, offset - 20))}
      onNext={() => nextOffset !== null && onOffset(nextOffset)}
    />
  );
  if (phone) return <PhoneHistory query={query} pages={pages} />;
  return (
    <section aria-labelledby="history-heading" className="flex flex-col panel px-6 py-5">
      <div className="flex flex-col gap-1 pb-3">
        <h2 id="history-heading" className="text-xl leading-7 font-medium">
          History
        </h2>
        <p className="text-xs text-text-secondary">
          In the order the app recorded it. A mail's own date can be earlier.
        </p>
      </div>
      {query.isLoading && <SkeletonList rows={3} label="Loading history" />}
      {query.isError && (
        <SectionError title="Could not load the history" onRetry={() => void query.refetch()} />
      )}
      {events && events.length === 0 && (
        <p className="text-sm text-text-secondary">
          Nothing yet. Mails the AI reads and sends from your automation show here.
        </p>
      )}
      {events && events.length > 0 && (
        <ol className="relative before:absolute before:top-5 before:bottom-5 before:left-[11px] before:w-px before:bg-border-subtle">
          {events.map((event) => (
            <HistoryRow key={event.id} event={event} />
          ))}
        </ol>
      )}
      {pages}
    </section>
  );
}
