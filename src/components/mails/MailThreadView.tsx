import { Fragment, useEffect, useRef, useState } from 'react';
import { useGmailAddress, useMailThread } from '../../api/mailbox';
import type { ConversationMail, DraftDoc } from '../../contracts/conversation';
import type { MailMessage } from '../../contracts/mailbox';
import { dayLabel, initiallyFolded, readingFor } from '../../lib/mailThread';
import { SkeletonList } from '../ui/skeleton';
import { Spinner } from '../ui/spinner';
import { MailboxProblem } from './MailboxProblem';
import { MailMessageCard } from './MailMessageCard';
import { MailReplyBox } from './MailReplyBox';
import { ReplyDocView } from './ReplyDocView';
import type { ReplyAi } from './ReplyAiHelp';

/** What the job side adds to a conversation: what the AI read, and which mail asks for the to-do. */
export interface ThreadJobContext {
  mails: readonly ConversationMail[];
  askingMessageId: string | null;
  /** Reply choices and "Write with AI" in the reply box. */
  ai?: ReplyAi;
}

/** The reply on its way: shown at once at the end of the conversation, then replaced by the sent mail. */
function SendingCard({ doc }: { doc: DraftDoc }) {
  return (
    <article
      aria-label="Your reply, sending"
      className="animate-open border border-border-subtle bg-surface p-4"
    >
      <ReplyDocView doc={doc} />
      <p role="status" className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
        <Spinner />
        Sending…
      </p>
    </article>
  );
}

/** The day lines and the mails of a conversation, older mails folded to one line each. */
function Messages({
  messages,
  mailbox,
  job,
}: {
  messages: MailMessage[];
  mailbox: string | null;
  job?: ThreadJobContext;
}) {
  const [folded, setFolded] = useState(() => initiallyFolded(messages.map((m) => m.id)));
  const fold = (id: string, value: boolean) =>
    setFolded((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  return messages.map((message, index) => {
    const day = dayLabel(message.date);
    const newDay = index === 0 || dayLabel(messages[index - 1].date) !== day;
    const last = index === messages.length - 1;
    const reading = job ? readingFor(message.id, job.mails) : null;
    // A fake offer's step is the app's own advice, not something the mail asks.
    const asks = !!job && job.askingMessageId === message.id && !reading?.fakeOfferWarning;
    return (
      <Fragment key={message.id}>
        {newDay && (
          <div className="flex min-h-8 items-center gap-4 text-xs text-text-secondary before:h-px before:flex-1 before:bg-border-subtle after:h-px after:flex-1 after:bg-border-subtle">
            {day}
          </div>
        )}
        <MailMessageCard
          message={message}
          mailbox={mailbox}
          reading={reading}
          asks={asks}
          folded={folded.has(message.id)}
          onFold={last ? undefined : (value) => fold(message.id, value)}
        />
      </Fragment>
    );
  });
}

/**
 * One Gmail thread read live when the page opens, as a conversation: oldest first, the newest
 * next to the reply box, each mail with only its own text. Shared by job mails and plain Gmail
 * mails. The text is shown and then dropped.
 */
export function MailThreadView({
  threadId,
  job,
  replyAsks = 0,
}: {
  threadId: string;
  job?: ThreadJobContext;
  /** Goes up each time the page's Reply button is clicked. */
  replyAsks?: number;
}) {
  const { data, error, isLoading, refetch } = useMailThread(threadId);
  const mailbox = useGmailAddress();
  const [sending, setSending] = useState<DraftDoc | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const loaded = !!data;
  // A long conversation opens at its newest mail, beside the reply box.
  useEffect(() => {
    if (loaded && end.current?.scrollIntoView) end.current.scrollIntoView({ block: 'nearest' });
  }, [loaded]);

  return (
    <section aria-label="Conversation" className="flex flex-col gap-2">
      {isLoading && <SkeletonList rows={3} label="Reading this mail from Gmail" />}
      {error && <MailboxProblem error={error} onRetry={() => void refetch()} />}
      {data && (
        <>
          <Messages key={threadId} messages={data.messages} mailbox={mailbox} job={job} />
          {sending && <SendingCard doc={sending} />}
          <div ref={end} />
          <MailReplyBox
            threadId={threadId}
            subject={data.subject}
            replyTo={data.replyTo}
            replyCc={data.replyCc}
            onCheck={() => void refetch()}
            onSending={setSending}
            replyAsks={replyAsks}
            ai={job?.ai}
          />
        </>
      )}
    </section>
  );
}
