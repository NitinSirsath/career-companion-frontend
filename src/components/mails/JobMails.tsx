import { Link } from '@tanstack/react-router';
import { CONVERSATION_PAGE_SIZE, useConversations } from '../../api/conversations';
import { filtersFromSearch, type MailsSearch } from '../../lib/mails';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { ConversationFilters } from './ConversationFilters';
import { ConversationTable } from './ConversationTable';

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

interface JobMailsProps {
  search: MailsSearch;
  onChange: (changes: Partial<MailsSearch>) => void;
}

/** The Job mails tab: the toolbar, the conversation table and its pages. */
export function JobMails({ search, onChange }: JobMailsProps) {
  const filters = filtersFromSearch(search);
  const offset = search.offset ?? 0;
  const { data, error, isLoading, isFetching, refetch } = useConversations(filters, offset);
  const nextOffset = data?.metadata.nextOffset ?? null;
  const filtered = Object.values(filters).some(Boolean);
  const goTo = (target: number) => onChange({ offset: target > 0 ? target : undefined });
  // A changed filter starts again at the first page.
  const filter = (changes: Partial<MailsSearch>) => onChange({ ...changes, offset: undefined });

  return (
    <ConversationTable
      conversations={data?.items ?? []}
      loading={isLoading}
      sort={{
        active: search.sort === 'newest' ? 'newest' : 'needs',
        onSort: (key) => filter({ sort: key === 'newest' ? 'newest' : undefined }),
      }}
      toolbar={<ConversationFilters search={search} onChange={filter} />}
      empty={
        error ? (
          <SectionError
            className="my-4"
            title="Could not load your job mails"
            onRetry={() => void refetch()}
          />
        ) : (
          data && (
            <NoJobMails
              narrowed={filtered || offset > 0}
              onClear={() =>
                filter({
                  q: undefined,
                  request: undefined,
                  category: undefined,
                  application: undefined,
                  unseen: undefined,
                })
              }
            />
          )
        )
      }
      footer={
        (offset > 0 || nextOffset !== null) && (
          <Pagination
            offset={offset}
            limit={CONVERSATION_PAGE_SIZE}
            hasNext={!isFetching && nextOffset !== null}
            onPrevious={() => goTo(Math.max(0, offset - CONVERSATION_PAGE_SIZE))}
            onNext={() => nextOffset !== null && goTo(nextOffset)}
          />
        )
      }
    />
  );
}
