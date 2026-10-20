import { createFileRoute, Link } from '@tanstack/react-router';
import { useConversation, useMarkSeenOnOpen } from '../api/conversations';
import { useMailThread } from '../api/mailbox';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { JobMailPanel } from '../components/mails/JobMailPanel';
import { MailThreadView } from '../components/mails/MailThreadView';
import { MailTitle } from '../components/mails/MailTitle';
import { Breadcrumb } from '../components/layout/PageHeader';
import { MailType } from '../components/mails/MailType';
import { SectionError } from '../components/ui/section-error';
import { SkeletonList } from '../components/ui/skeleton';
import { Tag } from '../components/ui/tag';
import { listSearch } from '../lib/listMemory';
import { askingMessageId } from '../lib/mailThread';
import { InlineNotification } from '../components/ui/notification';
import { companyAndRole, mailCounts, type MailsSearch } from '../lib/mails';

export const Route = createFileRoute('/mails/$key')({
  errorComponent: RouteErrorPage,
  component: JobMailPage,
});

/** "3 mails · 1 from you", counted in the conversation as Gmail has it now. */
function LiveMailCount({ threadId }: { threadId: string }) {
  const { data } = useMailThread(threadId);
  if (!data) return null;
  const fromYou = data.messages.filter((message) => message.sentByUser).length;
  return <span>{mailCounts(data.messages.length, fromYou)}</span>;
}

/** A job mail's details: the conversation as Gmail has it, beside what it means for the search. */
function JobMailPage() {
  const { key } = Route.useParams();
  const { data, error, isLoading, refetch } = useConversation(key);
  const conversation = data?.conversation;
  useMarkSeenOnOpen(conversation);
  const summary = conversation && companyAndRole(conversation);

  const breadcrumb = (
    <Breadcrumb current={conversation?.company ?? undefined}>
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
          >
            {summary && <span>{summary}</span>}
            {conversation.category && <MailType category={conversation.category} />}
            {conversation.threadId ? (
              <LiveMailCount threadId={conversation.threadId} />
            ) : (
              <span>{mailCounts(conversation.mailCount, conversation.sentCount)}</span>
            )}
            {conversation.isNew && <Tag color="blue">New</Tag>}
          </MailTitle>
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              {conversation.threadId ? (
                <MailThreadView
                  threadId={conversation.threadId}
                  job={{ mails: data.mails, askingMessageId: askingMessageId(data) }}
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
