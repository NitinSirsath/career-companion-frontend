
import { useMailThread } from '../../api/mailbox';
import { mailCounts } from '../../lib/mails';

import { MailboxProblem } from './MailboxProblem';
import { MailMessageCard } from './MailMessageCard';
import { MailReplyBox } from './MailReplyBox';

/**
 * One Gmail thread read live when the page opens: every message in order, with the user's own
 * replies, and the box to reply from here. Shared by job mails and plain Gmail mails. The text
 * is shown and then dropped.
 */
export function MailThreadView({ threadId }: { threadId: string }) {
  const { data, error, isLoading, refetch } = useMailThread(threadId);

  const fromYou = data?.messages.filter((message) => message.sentByUser).length ?? 0;
  return (
    <section aria-label="Conversation" className="space-y-4">
      {isLoading && (
        <p role="status" className="text-sm text-text-secondary">
          Reading this mail from Gmail…
        </p>
      )}
      {error && <MailboxProblem error={error} onRetry={() => void refetch()} />}
      {data && (
        <>
          <h2 className="text-sm font-semibold text-text-secondary">
            Conversation · {mailCounts(data.messages.length, fromYou)}
          </h2>
          {data.messages.map((message) => (
            <MailMessageCard key={message.id} message={message} />
          ))}
          <MailReplyBox
            threadId={threadId}
            subject={data.subject}
            replyTo={data.replyTo}
            onCheck={() => void refetch()}
          />
        </>
      )}
    </section>
  );
}
