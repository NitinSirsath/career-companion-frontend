import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { CONVERSATION_PAGE_SIZE, useConversations } from '../../api/conversations';
import type { Conversation } from '../../contracts/conversation';
import { conversationSummary, fakeOfferStep, mailDate } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { ChevronRightIcon as ChevronIcon } from 'lucide-react';
import { useIsPhone } from '../layout/useIsPhone';
import { Pagination } from '../ui/pagination';
import { PHONE_ROW, PhoneGroupSection as PhoneSection } from '../phone/PhoneList';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { ConversationTable } from './ConversationTable';
import { TodoState } from './TodoState';

const countLine = (count: number, more: boolean) =>
  `${count === 1 ? '1 conversation' : `${count} conversations`}${more ? ' on this page' : ''}`;

/** One conversation on a phone: a row that opens the mail (owner, 12 Nov 2026). */
function PhoneConversationRow({ conversation }: { conversation: Conversation }) {
  return (
    <Link to="/mails/$key" params={{ key: conversation.key }} className={PHONE_ROW}>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            'text-[15px] leading-[21px] break-words',
            conversation.isNew && 'font-semibold',
          )}
        >
          {conversation.subject || '(No subject)'}
        </span>
        <span className="text-[13px] break-words text-text-secondary">
          {conversationSummary(conversation)}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-[13px] text-text-secondary">
          {conversation.request && (
            <TodoState state={conversation.request.state} fakeOffer={fakeOfferStep(conversation)} />
          )}
          Last mail {mailDate(conversation.lastReceivedAt)}
        </span>
      </span>
      <ChevronIcon size={18} className="shrink-0 text-text-tertiary" />
    </Link>
  );
}

/** The conversations on a phone, as one grouped list. */
function PhoneConversations({
  result,
  pages,
}: {
  result: ReturnType<typeof useConversations>;
  pages: ReactNode;
}) {
  const { data, error, isLoading, refetch } = result;
  return (
    <PhoneSection
      title="Conversations"
      count={data && data.items.length > 0 ? data.items.length : undefined}
    >
      {isLoading && <SkeletonList rows={2} label="Loading conversations" />}
      {error && (
        <SectionError title="Could not load the conversations" onRetry={() => void refetch()} />
      )}
      {data && data.items.length === 0 && (
        <p className={cn(PHONE_ROW, 'text-sm text-text-secondary')}>
          No mails yet. Mails about this job join here by themselves.
        </p>
      )}
      {data?.items.map((conversation) => (
        <PhoneConversationRow key={conversation.key} conversation={conversation} />
      ))}
      {pages}
    </PhoneSection>
  );
}

/** Every mail thread of one application. Each row opens the mail's details page. */
export function ApplicationConversations({ applicationId }: { applicationId: string }) {
  const [offset, setOffset] = useState(0);
  const result = useConversations({ application: applicationId }, offset);
  const { data, error, isFetching, isLoading, refetch } = result;
  const nextOffset = data?.metadata.nextOffset ?? null;
  const phone = useIsPhone();
  const pages = (offset > 0 || nextOffset !== null) && (
    <Pagination
      offset={offset}
      limit={CONVERSATION_PAGE_SIZE}
      hasNext={!isFetching && nextOffset !== null}
      onPrevious={() => setOffset(Math.max(0, offset - CONVERSATION_PAGE_SIZE))}
      onNext={() => nextOffset !== null && setOffset(nextOffset)}
    />
  );
  if (phone) return <PhoneConversations result={result} pages={pages} />;
  return (
    <section aria-labelledby="conversations-heading" className="flex flex-col panel pt-5">
      <div className="flex items-baseline gap-3 px-6 pb-3">
        <h2 id="conversations-heading" className="text-xl leading-7 font-medium">
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
      {data && data.items.length > 0 && <ConversationTable conversations={data.items} />}
      {pages}
    </section>
  );
}
