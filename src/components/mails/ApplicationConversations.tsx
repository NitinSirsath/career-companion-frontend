import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { CONVERSATION_PAGE_SIZE, useConversations } from '../../api/conversations';
import type { Conversation } from '../../contracts/conversation';
import { mailDate, parseSender } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { useIsPhone } from '../layout/useIsPhone';
import { Pagination } from '../ui/pagination';
import { DETAIL_ROW, DetailSection } from '../applications/DetailSection';
import { Avatar } from '../ui/avatar';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { ConversationTable } from './ConversationTable';

const countLine = (count: number, more: boolean) =>
  `${count === 1 ? '1 conversation' : `${count} conversations`}${more ? ' on this page' : ''}`;

/**
 * One conversation on a phone (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 6): the
 * person, the subject in grey, the date; a tap opens the mail.
 */
function PhoneConversationRow({ conversation }: { conversation: Conversation }) {
  const who = parseSender(conversation.sender).name;
  return (
    <Link
      to="/mails/$key"
      params={{ key: conversation.key }}
      className={cn(DETAIL_ROW, 'gap-2.5 py-2 text-[14.5px]')}
    >
      <Avatar name={who} className="size-[26px] text-[10px]" />
      <span className="min-w-0 flex-1 truncate">
        <span className={cn(conversation.isNew && 'font-semibold')}>{who}</span>
        <span className="text-text-secondary"> · {conversation.subject || '(No subject)'}</span>
      </span>
      <span className="shrink-0 text-[13px] text-text-tertiary">
        {mailDate(conversation.lastReceivedAt)}
      </span>
    </Link>
  );
}

/** The conversations on a phone, as plain rows under "Mails". */
function PhoneConversations({
  result,
  pages,
}: {
  result: ReturnType<typeof useConversations>;
  pages: ReactNode;
}) {
  const { data, error, isLoading, refetch } = result;
  return (
    <DetailSection
      title="Mails"
      count={data && data.items.length > 0 ? data.items.length : undefined}
    >
      {isLoading && <SkeletonList rows={2} label="Loading conversations" />}
      {error && (
        <SectionError title="Could not load the conversations" onRetry={() => void refetch()} />
      )}
      {data && data.items.length === 0 && (
        <p className="px-[18px] py-2 text-[15px] text-text-secondary">
          No mails yet. Mails about this job join here by themselves.
        </p>
      )}
      {data?.items.map((conversation) => (
        <PhoneConversationRow key={conversation.key} conversation={conversation} />
      ))}
      {pages}
    </DetailSection>
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
