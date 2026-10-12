import { useState } from 'react';
import { CONVERSATION_PAGE_SIZE, useConversations } from '../../api/conversations';
import { Pagination } from '../ui/pagination';
import { ConversationTable } from './ConversationTable';

/** Every mail thread of one application. Each row opens the mail's details page. */
export function ApplicationConversations({ applicationId }: { applicationId: string }) {
  const [offset, setOffset] = useState(0);
  const { data, error, isFetching } = useConversations({ application: applicationId }, offset);
  const nextOffset = data?.metadata.nextOffset ?? null;
  return (
    <section className="space-y-3" aria-labelledby="conversations-heading">
      <h3 id="conversations-heading" className="text-lg font-semibold">
        Conversations
      </h3>
      <p className="text-xs text-text-secondary">
        Every mail thread of this application. Mails from the same company and role join by
        themselves.
      </p>
      {error && (
        <p role="alert" className="text-sm">
          Could not load conversations: {error.message}
        </p>
      )}
      {data && data.items.length === 0 && (
        <p className="text-sm text-text-secondary">No mail conversations yet.</p>
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
