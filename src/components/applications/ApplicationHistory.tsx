import { useRef, useState } from 'react';
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
import type { DialogHandle } from '../../lib/dialogs';
import { MatchCorrectionDialog } from '../MatchCorrectionDialog';
import { Button } from '../ui/button';
import { OverflowMenu, type MenuAction } from '../ui/menu';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';

/** What the automation reported: where it sent the application, when, and what the site said. */
function SubmissionFacts({ event }: { event: ApplicationEventResponse }) {
  const submission = event.sourceSubmission;
  if (!submission) return null;
  return (
    <div className="flex flex-col gap-1 text-xs tracking-[0.32px] text-text-secondary">
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
    <div className="flex flex-col items-start">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? 'Hide the AI note' : 'Show the AI note'}
      </Button>
      {open && (
        <div className="flex w-full animate-open flex-col gap-1 bg-layer-accent px-3 py-2 text-xs tracking-[0.32px] text-text-secondary">
          {event.description && <p className="break-words">{event.description}</p>}
          {event.provenance && <p className="break-words italic">{event.provenance}</p>}
          <p>This is the AI's reading, not the mail's own words.</p>
          <AnalyzedBy provider={event.analyzedBy?.provider} model={event.analyzedBy?.model} />
        </div>
      )}
    </div>
  );
}

/** The row's "…": open its mail, or move the mail to another application. */
function RowMenu({ event, entry }: { event: ApplicationEventResponse; entry: HistoryEntry }) {
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
  return (
    <>
      <OverflowMenu label={`More for ${entry.title}`} actions={actions} />
      <MatchCorrectionDialog
        emailId={mailId}
        matchState="MATCHED"
        applicationId={event.applicationId}
        trigger={false}
        ref={correction}
      />
    </>
  );
}

function HistoryRow({ event }: { event: ApplicationEventResponse }) {
  const entry = historyEntry(event);
  const retired = retiredLine(event);
  return (
    <li
      className={cn(
        'relative grid grid-cols-[24px_minmax(0,1fr)_auto] gap-x-3 py-3',
        retired && 'text-text-secondary',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative z-10 mt-1.5 ml-[7px] size-[9px]',
          entry.kind === 'mail' && !retired
            ? 'bg-link'
            : 'bg-surface shadow-[inset_0_0_0_1px_var(--text-secondary)]',
        )}
      />
      <div className="flex min-w-0 flex-col gap-1">
        {entry.mailId ? (
          <Link
            to="/mails/$key"
            params={{ key: entry.mailId }}
            className="break-words text-text-primary hover:underline"
          >
            {entry.title}
          </Link>
        ) : (
          <span className="break-words">{entry.title}</span>
        )}
        {entry.detail && (
          <span className="text-xs tracking-[0.32px] text-text-secondary">{entry.detail}</span>
        )}
        {retired && <span className="text-xs tracking-[0.32px]">{retired}</span>}
        {entry.kind === 'automation' && <SubmissionFacts event={event} />}
        {entry.kind !== 'automation' && !retired && <AiNote event={event} />}
      </div>
      <div className="flex items-start gap-1">
        <time
          dateTime={event.recordedAt}
          title={`Recorded ${dateAndTime(event.recordedAt)}`}
          className="pt-0.5 text-xs tracking-[0.32px] whitespace-nowrap text-text-secondary"
        >
          {mailDateTime(event.recordedAt)}
        </time>
        <RowMenu event={event} entry={entry} />
      </div>
    </li>
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
  const nextOffset = query.data?.metadata.nextOffset ?? null;
  return (
    <section aria-labelledby="history-heading" className="flex flex-col bg-surface px-6 py-5">
      <div className="flex flex-col gap-1 pb-3">
        <h2 id="history-heading" className="text-xl leading-7">
          History
        </h2>
        <p className="text-xs tracking-[0.32px] text-text-secondary">
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
      {(offset > 0 || nextOffset !== null) && (
        <Pagination
          offset={offset}
          limit={20}
          hasNext={nextOffset !== null}
          onPrevious={() => onOffset(Math.max(0, offset - 20))}
          onNext={() => nextOffset !== null && onOffset(nextOffset)}
        />
      )}
    </section>
  );
}
