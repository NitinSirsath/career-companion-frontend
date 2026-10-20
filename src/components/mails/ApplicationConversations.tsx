import { useState } from 'react';
import { CONVERSATION_PAGE_SIZE, useConversations } from '../../api/conversations';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { ConversationTable } from './ConversationTable';

const countLine = (count: number, more: boolean) =>
  `${count === 1 ? '1 conversation' : `${count} conversations`}${more ? ' on this page' : ''}`;

/** Every mail thread of one application. Each row opens the mail's details page. */
export function ApplicationConversations({ applicationId }: { applicationId: string }) {
  const [offset, setOffset] = useState(0);
  const { data, error, isFetching, isLoading, refetch } = useConversations(
    { application: applicationId },
    offset,
  );
  const nextOffset = data?.metadata.nextOffset ?? null;
  return (
    <section aria-labelledby="conversations-heading" className="flex flex-col bg-surface pt-5">
      <div className="flex items-baseline gap-3 px-6 pb-3">
        <h2 id="conversations-heading" className="text-xl leading-7">
          Conversations
        </h2>
        {data && data.items.length > 0 && (
          <span className="text-xs text-text-secondary">
            {countLine(data.items.length, nextOffset !== null)}
          </span>
        )}
      </div>
      {isLoading && <SkeletonList rows={2} label="Loading conversations" />}
      {error && (
        <SectionError
          title="Could not load the conversations"
          onRetry={() => void refetch()}
          className="mx-6 mb-5"
        />
      )}
      {data && data.items.length === 0 && (
        <p className="px-6 pb-5 text-sm text-text-secondary">
          No mails yet. Mails about this job join here by themselves.
        </p>
      )}
      {data && data.items.length > 0 && <ConversationTable conversations={data.items} compact />}
      {(offset > 0 || nextOffset !== null) && (
        <Pagination
          offset={offset}
          limit={CONVERSATION_PAGE_SIZE}
          hasNext={!isFetching && nextOffset !== null}
          onPrevious={() => setOffset(Math.max(0, offset - CONVERSATION_PAGE_SIZE))}
          onNext={() => nextOffset !== null && setOffset(nextOffset)}
        />
      )}
    </section>
  );
}
