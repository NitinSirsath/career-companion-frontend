import { Link } from '@tanstack/react-router';
import { CONVERSATION_PAGE_SIZE, useConversations } from '../../api/conversations';
import { filtersFromSearch, type MailsSearch } from '../../lib/mails';
import { Button } from '../ui/button';
import { Pagination } from '../ui/pagination';
import { ConversationFilters } from './ConversationFilters';
import { ConversationTable } from './ConversationTable';

/** The empty list: nothing matches the view, or no job mail has arrived yet. */
function NoJobMails({ narrowed }: { narrowed: boolean }) {
  return (
    <div className="border border-border-default bg-surface-subtle p-8 text-center space-y-2">
      <p className="text-base font-medium">
        {narrowed ? 'No job mails match this view' : 'No job mails yet'}
      </p>
      <p className="text-sm text-text-secondary">
        {narrowed
          ? 'Try changing the search or the filters.'
          : 'New job mails from Gmail show here with what they need from you.'}
      </p>
      {!narrowed && (
        <Link to="/gmail" className="inline-block text-sm underline">
          Open Gmail Sync
        </Link>
      )}
    </div>
  );
}

interface JobMailsProps {
  search: MailsSearch;
  onChange: (changes: Partial<MailsSearch>) => void;
}

/** The Job mails tab: filters, the conversation table and its pages. */
export function JobMails({ search, onChange }: JobMailsProps) {
  const filters = filtersFromSearch(search);
  const offset = search.offset ?? 0;
  const { data, error, isLoading, isFetching, refetch } = useConversations(filters, offset);
  const nextOffset = data?.metadata.nextOffset ?? null;
  const filtered = Object.values(filters).some(Boolean);
  const goTo = (target: number) => onChange({ offset: target > 0 ? target : undefined });

  return (
    <div className="space-y-6">
      {/* A changed filter starts again at the first page. */}
      <ConversationFilters
        search={search}
        onChange={(changes) => onChange({ ...changes, offset: undefined })}
      />
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span>Could not load your job mails: {error.message}</span>
          <Button variant="tertiary" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}
      {isLoading && (
        <p role="status" className="text-sm text-text-secondary">
          Loading job mails…
        </p>
      )}
      {data && data.items.length > 0 && <ConversationTable conversations={data.items} />}
      {data && data.items.length === 0 && <NoJobMails narrowed={filtered || offset > 0} />}
      {(offset > 0 || nextOffset !== null) && (
        <Pagination
          offset={offset}
          limit={CONVERSATION_PAGE_SIZE}
          hasNext={!isFetching && nextOffset !== null}
          onPrevious={() => goTo(Math.max(0, offset - CONVERSATION_PAGE_SIZE))}
          onNext={() => nextOffset !== null && goTo(nextOffset)}
        />
      )}
    </div>
  );
}
