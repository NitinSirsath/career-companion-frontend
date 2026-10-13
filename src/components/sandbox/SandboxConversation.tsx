import { Link } from '@tanstack/react-router';
import { useSandboxThread } from '../../api/sandbox';
import { isApiError } from '../../api/client';
import { mailCounts, parseSender } from '../../lib/mails';
import { sandboxProblem } from '../../lib/sandbox';
import { SandboxAppPanel } from './SandboxAppPanel';
import { SandboxMessageCard } from './SandboxMessageCard';
import { SandboxReplyForm } from './SandboxReplyForm';

/** One sandbox conversation: both sides with their text, a reply box, and what the app did. */
export function SandboxConversation({ threadId }: { threadId: string }) {
  const { data, error, isLoading } = useSandboxThread(threadId);
  const missing = isApiError(error) && (error.status === 404 || error.status === 400);
  const fromMe = data?.messages.filter((message) => message.sentByUser).length ?? 0;

  return (
    <div className="space-y-4">
      <Link to="/sandbox" className="inline-block text-sm font-medium underline">
        Back to Inbox
      </Link>
      {isLoading && (
        <p role="status" className="text-sm text-text-secondary">
          Reading the conversation…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-status-error">
          {missing ? 'This conversation is not in your sandbox mailbox.' : sandboxProblem(error)}
        </p>
      )}
      {data && (
        <>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">{data.subject || '(No subject)'}</h2>
            <p className="text-sm text-text-secondary">
              {mailCounts(data.messages.length, fromMe)} · with{' '}
              {parseSender(data.party).address ?? data.party}
            </p>
          </div>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
            <section aria-label="Conversation" className="min-w-0 flex-1 space-y-4">
              {data.messages.map((message) => (
                <SandboxMessageCard key={message.id} message={message} />
              ))}
              <SandboxReplyForm threadId={threadId} party={data.party} />
            </section>
            <SandboxAppPanel messages={data.messages} />
          </div>
        </>
      )}
    </div>
  );
}
