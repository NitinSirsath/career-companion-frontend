import { Link } from '@tanstack/react-router';
import { MailIcon, SearchXIcon } from 'lucide-react';
import { useSandboxMailbox } from '../../api/appMode';
import { CONVERSATION_PAGE_SIZE, useConversations } from '../../api/conversations';
import { useGmailStatus } from '../../api/gmail';
import { gmailConnectionCopy } from '../../lib/gmailConnection';
import { filtersFromSearch, type MailsSearch } from '../../lib/mails';
import { MISSED } from '../../lib/missed';
import { useIsPhone } from '../layout/useIsPhone';
import { EMPTY_ACTION, EMPTY_ACTION_QUIET, EmptyState } from '../ui/empty-state';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { SkeletonRows } from '../ui/skeleton';
import { leavingProps, listPhaseClass, useListMotion } from '../ui/useListMotion';
import { MailRow } from './MailRow';
import { PhoneMailRow } from './PhoneMailRow';

/** The empty list: nothing matches the view, or no job mail has arrived yet. */
function NoJobMails({
  narrowed,
  words,
  onClear,
}: {
  narrowed: boolean;
  words: string | undefined;
  onClear: () => void;
}) {
  const sandbox = useSandboxMailbox();
  const gmail = useGmailStatus();
  if (narrowed)
    return (
      <EmptyState
        icon={SearchXIcon}
        title={words ? `No results for “${words}”` : 'No job mails match these filters'}
        action={
          <button type="button" className={EMPTY_ACTION_QUIET} onClick={onClear}>
            Clear filters
          </button>
        }
      >
        Try other words, or clear the filters.
      </EmptyState>
    );
  if (gmail.data?.connected === false)
    return (
      <EmptyState
        icon={MailIcon}
        title="No job mails yet"
        action={
          <Link to="/gmail" className={EMPTY_ACTION}>
            {gmailConnectionCopy(sandbox, gmail.data.status).connect}
          </Link>
        }
      >
        Connect Gmail and NorthList finds your job mails, with what each one needs from you.
      </EmptyState>
    );
  return (
    <EmptyState icon={MailIcon} title="No job mails yet">
      NorthList checks your Gmail and shows each new job mail here, with what it needs from you.
    </EmptyState>
  );
}

/**
 * Under the list while the Missed filter is on (owner, 26 Nov 2026): what these mails are. Phones
 * say it in the line under the list, in the summary's place.
 */
function MissedListNote({ search, phone }: { search: MailsSearch; phone: boolean }) {
  if (phone || search.request !== 'missed') return null;
  return <p className="px-2.5 pt-4 text-xs text-text-secondary">{MISSED.listNote.laptop}</p>;
}

/** A search, a filter or a later page: the empty list then says nothing matches. */
const isNarrowed = (search: MailsSearch) =>
  [search.q, search.request, search.category, search.application, search.unseen].some(Boolean) ||
  (search.offset ?? 0) > 0;

/** The search and every filter off, back at the first page. */
const NOTHING_NARROWED: Partial<MailsSearch> = {
  q: undefined,
  request: undefined,
  category: undefined,
  application: undefined,
  unseen: undefined,
  offset: undefined,
};

interface JobMailsProps {
  search: MailsSearch;
  onChange: (changes: Partial<MailsSearch>) => void;
}

/**
 * The Job mails list (owner, 3 Nov 2026): one list, newest first unless "Needs action first" is
 * chosen, one row per conversation, then the pages.
 */
export function JobMails({ search, onChange }: JobMailsProps) {
  const phone = useIsPhone();
  const filters = filtersFromSearch(search);
  const offset = search.offset ?? 0;
  const { data, error, isLoading, isFetching, isPlaceholderData, refetch } = useConversations(
    filters,
    offset,
  );
  const nextOffset = data?.metadata.nextOffset ?? null;
  const narrowed = isNarrowed(search);
  const goTo = (target: number) => onChange({ offset: target > 0 ? target : undefined });
  const items = data?.items ?? [];
  // A row marked done under "Needs action" shrinks away; a new mail grows in. A new filter or page
  // is drawn at once, and so is the last list while the new one loads.
  const listKey = `${isPlaceholderData ? 'placeholder:' : ''}${JSON.stringify(filters)}:${offset}`;
  const rows = useListMotion(items, (conversation) => conversation.key, listKey);

  if (error)
    return (
      <SectionError
        className="my-4"
        title="Could not load your job mails"
        onRetry={() => void refetch()}
      />
    );
  if (isLoading) return <SkeletonRows label="Loading job mails" />;
  if (data && items.length === 0)
    return (
      <NoJobMails narrowed={narrowed} words={search.q} onClear={() => onChange(NOTHING_NARROWED)} />
    );
  return (
    <div>
      {phone ? (
        <div aria-label="Job mails" role="list">
          {rows.map(({ key, item, phase }) => (
            <div
              role="listitem"
              key={key}
              className={listPhaseClass(phase)}
              {...leavingProps(phase)}
            >
              <div className={phase === 'stay' ? undefined : 'min-h-0 overflow-clip'}>
                <PhoneMailRow conversation={item} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ul aria-label="Job mails">
          {rows.map(({ key, item, phase }) => (
            <li key={key} className={listPhaseClass(phase)} {...leavingProps(phase)}>
              <div className={phase === 'stay' ? undefined : 'min-h-0 overflow-clip'}>
                <MailRow conversation={item} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {(offset > 0 || nextOffset !== null) && (
        <Pagination
          offset={offset}
          limit={CONVERSATION_PAGE_SIZE}
          hasNext={!isFetching && nextOffset !== null}
          onPrevious={() => goTo(Math.max(0, offset - CONVERSATION_PAGE_SIZE))}
          onNext={() => nextOffset !== null && goTo(nextOffset)}
        />
      )}
      <MissedListNote search={search} phone={phone} />
    </div>
  );
}
