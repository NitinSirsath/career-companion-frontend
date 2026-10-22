import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Building } from '@carbon/icons-react';
import { useConversation, useMarkSeenOnOpen } from '../api/conversations';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { JobMailPanel } from '../components/mails/JobMailPanel';
import { MailFacts } from '../components/mails/MailFacts';
import { MailThreadView } from '../components/mails/MailThreadView';
import { MailTitle } from '../components/mails/MailTitle';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { SectionError } from '../components/ui/section-error';
import { SkeletonList } from '../components/ui/skeleton';
import { listSearch } from '../lib/listMemory';
import { askingMessageId } from '../lib/mailThread';
import { InlineNotification } from '../components/ui/notification';
import type { MailsSearch } from '../lib/mails';

export const Route = createFileRoute('/mails/$key')({
  errorComponent: RouteErrorPage,
  component: JobMailPage,
});

/** A job mail's details: the conversation as Gmail has it, beside what it means for the search. */
function JobMailPage() {
  const { key } = Route.useParams();
  const { data, error, isLoading, refetch } = useConversation(key);
  const conversation = data?.conversation;
  useMarkSeenOnOpen(conversation);
  // Counts the header's Reply clicks; each one opens the reply box under the conversation.
  const [replyAsks, setReplyAsks] = useState(0);

  const breadcrumb = (
    <Breadcrumb current={conversation?.company ?? undefined} currentIcon={Building}>
      <Link to="/mails" search={listSearch<MailsSearch>('/mails')}>
        Mails
      </Link>
    </Breadcrumb>
  );

  return (
    <div className="space-y-6">
      {isLoading && (
        <>
          {breadcrumb}
          <SkeletonList rows={4} label="Loading this mail" />
        </>
      )}
      {error && (
        <>
          {breadcrumb}
          <SectionError title="Could not load this mail" onRetry={() => void refetch()} />
        </>
      )}
      {data && conversation && (
        <>
          <MailTitle
            title={conversation.subject || '(No subject)'}
            threadId={conversation.threadId}
            breadcrumb={breadcrumb}
            onReply={() => setReplyAsks((asks) => asks + 1)}
          >
            <MailFacts conversation={conversation} />
          </MailTitle>
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              {conversation.threadId ? (
                <MailThreadView
                  threadId={conversation.threadId}
                  job={{ mails: data.mails, askingMessageId: askingMessageId(data) }}
                  replyAsks={replyAsks}
                />
              ) : (
                <InlineNotification>
                  Gmail gave this mail no conversation, so its text cannot be shown here.
                </InlineNotification>
              )}
            </div>
            <JobMailPanel detail={data} />
          </div>
        </>
      )}
    </div>
  );
}
