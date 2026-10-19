import { createFileRoute, Link } from '@tanstack/react-router';
import { useConversation, useMarkSeenOnOpen } from '../api/conversations';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { JobMailPanel } from '../components/mails/JobMailPanel';
import { MailThreadView } from '../components/mails/MailThreadView';
import { MailTitle } from '../components/mails/MailTitle';
import { Tag } from '../components/ui/tag';
import { Button } from '../components/ui/button';
import { CATEGORY_LABEL, companyAndRole } from '../lib/mails';

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
  const summary = conversation && companyAndRole(conversation);

  return (
    <div className="space-y-6">
      <Link to="/mails" className="inline-block text-sm font-medium underline">
        Back to Mails
      </Link>
      {isLoading && (
        <p role="status" className="text-sm text-text-secondary">
          Loading this mail…
        </p>
      )}
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
          <span>Could not load this mail: {error.message}</span>
          <Button variant="tertiary" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}
      {data && conversation && (
        <>
          <MailTitle
            title={conversation.subject || '(No subject)'}
            threadId={conversation.threadId}
          >
            {summary && <span>{summary}</span>}
            {conversation.category && (
              <Tag color="outline">{CATEGORY_LABEL[conversation.category]}</Tag>
            )}
            {conversation.isNew && <Tag color="blue">New</Tag>}
          </MailTitle>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 min-w-0">
              {conversation.threadId ? (
                <MailThreadView threadId={conversation.threadId} />
              ) : (
                <p className="border border-border-default bg-surface-subtle p-4 text-sm">
                  Gmail gave this mail no conversation, so its text cannot be shown here.
                </p>
              )}
            </div>
            <JobMailPanel detail={data} />
          </div>
        </>
      )}
    </div>
  );
}
