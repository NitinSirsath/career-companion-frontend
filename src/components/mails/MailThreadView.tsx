import { useMailThread } from '../../api/mailbox';
import { mailCounts } from '../../lib/mails';
import { GmailLink } from '../ui/GmailLink';
import { MailboxProblem } from './MailboxProblem';
import { MailMessageCard } from './MailMessageCard';

/**
 * One Gmail thread read live when the page opens: every message in order, with the user's own
 * replies. Shared by job mails and plain Gmail mails. The text is shown and then dropped.
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
          <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-border-strong p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Reply</p>
              <p className="text-xs text-text-secondary">
                Replying from here comes later. For now, reply in Gmail.
              </p>
            </div>
            <GmailLink threadId={threadId} subject={data.subject} reply />
          </div>
        </>
      )}
    </section>
  );
}
