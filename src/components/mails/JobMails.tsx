import { Link } from '@tanstack/react-router';
import { CONVERSATION_PAGE_SIZE, useConversations } from '../../api/conversations';
import { filtersFromSearch, type MailsSearch } from '../../lib/mails';
import { useIsPhone } from '../layout/useIsPhone';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { MailRow } from './MailRow';
import { PhoneMailRow } from './PhoneMailRow';
import { SyncLine } from './SyncLine';

/** The empty list: nothing matches the view, or no job mail has arrived yet. */
function NoJobMails({ narrowed, onClear }: { narrowed: boolean; onClear: () => void }) {
  if (narrowed)
    return (
      <EmptyState
        title="No job mails match this view"
        action={
          <Button variant="ghost" className="-ml-4" onClick={onClear}>
            Clear all filters
          </Button>
        }
      >
        Try changing the search or the filters.
      </EmptyState>
    );
  return (
    <EmptyState title="No job mails yet" action={<Link to="/gmail">Open Gmail Sync</Link>}>
      New job mails from Gmail show here with what they need from you.
    </EmptyState>
  );
}

/** A search, a filter or a later page: the empty list then says nothing matches. */
const isNarrowed = (search: MailsSearch) =>
  [search.q, search.request, search.category, search.application, search.unseen].some(Boolean) ||
  (search.offset ?? 0) > 0;

function LoadingRows() {
  return (
    <div aria-busy="true" aria-label="Loading job mails" className="flex flex-col gap-2 pt-2">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="skeleton h-20 rounded-lg" />
      ))}
    </div>
  );
}

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
  const { data, error, isLoading, isFetching, refetch } = useConversations(filters, offset);
  const nextOffset = data?.metadata.nextOffset ?? null;
  const narrowed = isNarrowed(search);
  const goTo = (target: number) => onChange({ offset: target > 0 ? target : undefined });
  const items = data?.items ?? [];

  if (error)
    return (
      <SectionError
        className="my-4"
        title="Could not load your job mails"
        onRetry={() => void refetch()}
      />
    );
  if (isLoading) return <LoadingRows />;
  if (data && items.length === 0)
    return (
      <NoJobMails
        narrowed={narrowed}
        onClear={() =>
          onChange({
            q: undefined,
            request: undefined,
            category: undefined,
            application: undefined,
            unseen: undefined,
            offset: undefined,
          })
        }
      />
    );
  return (
    <div>
      {phone ? (
        <div aria-label="Job mails" role="list" className="-mx-4 border-t border-border-subtle">
          {items.map((conversation) => (
            <div role="listitem" key={conversation.key}>
              <PhoneMailRow conversation={conversation} />
            </div>
          ))}
        </div>
      ) : (
        <ul aria-label="Job mails">
          {items.map((conversation) => (
            <MailRow key={conversation.key} conversation={conversation} />
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
      {phone && <SyncLine look="note" />}
    </div>
  );
}
