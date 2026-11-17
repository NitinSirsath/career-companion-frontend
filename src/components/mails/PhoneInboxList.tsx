import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import type { MailboxThread } from '../../contracts/mailbox';
import { mailDate, parseSender, snippetText } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { SkeletonRows } from '../ui/skeleton';
import { Tag } from '../ui/tag';

const ROW =
  'relative flex bg-background pt-2.5 pr-5 pb-[11px] pl-5 text-text-primary transition-colors duration-450 select-none after:absolute after:right-0 after:bottom-0 after:left-5 after:h-[0.5px] after:bg-border-strong/55 active:bg-surface-selected active:duration-0';

/** The row's words: who and when, the subject, two lines of the mail, and "Job mail" when it is one. */
function RowWords({ thread }: { thread: MailboxThread }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-[16px] left-[5px] size-2.5 rounded-full bg-link transition-[scale,opacity] duration-300 ease-standard',
          thread.unread ? 'scale-100 opacity-100' : 'scale-0 opacity-0 delay-200',
        )}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[17px] leading-[22px] font-semibold">
            {parseSender(thread.from).name}
            {thread.messageCount > 1 && (
              <span className="font-normal text-text-tertiary"> {thread.messageCount}</span>
            )}
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[15px] text-text-tertiary tabular-nums">
            {mailDate(thread.date)}
            <ChevronRightIcon size={15} aria-hidden="true" />
          </span>
        </span>
        <span className="truncate text-[15px] leading-5">{thread.subject || '(No subject)'}</span>
        {thread.snippet && (
          <span className="line-clamp-2 text-[15px] leading-5 text-text-secondary">
            {snippetText(thread.snippet)}
          </span>
        )}
        {thread.conversationKey && (
          <span className="mt-1 flex">
            <Tag color="outline">Job mail</Tag>
          </span>
        )}
      </span>
    </>
  );
}

/**
 * A mail of the Whole inbox on a phone (15 Nov 2026), drawn like a Job mails row: edge to edge,
 * the words under the title's first letter, a blue dot in the margin while unread. A job mail
 * opens its conversation; any other mail opens as Gmail has it.
 */
function PhoneInboxRow({ thread }: { thread: MailboxThread }) {
  const label = `${thread.subject || '(No subject)'}, from ${parseSender(thread.from).name}${thread.unread ? ', unread' : ''}`;
  return thread.conversationKey ? (
    <Link
      to="/mails/$key"
      params={{ key: thread.conversationKey }}
      aria-label={label}
      className={ROW}
    >
      <RowWords thread={thread} />
    </Link>
  ) : (
    <Link
      to="/mails/gmail/$threadId"
      params={{ threadId: thread.threadId }}
      aria-label={label}
      className={ROW}
    >
      <RowWords thread={thread} />
    </Link>
  );
}

/** The Whole inbox on a phone: grey rows while it loads, the empty state, or the mails and the pager. */
export function PhoneInboxList({
  threads,
  loading,
  empty,
  footer,
}: {
  threads: readonly MailboxThread[] | undefined;
  loading: boolean;
  empty: ReactNode;
  footer: ReactNode;
}) {
  if (loading) return <SkeletonRows label="Loading the inbox" />;
  if (!threads?.length) return <>{empty}</>;
  return (
    <>
      <div role="list" aria-label="Whole inbox">
        {threads.map((thread) => (
          <div role="listitem" key={thread.threadId}>
            <PhoneInboxRow thread={thread} />
          </div>
        ))}
      </div>
      {footer}
    </>
  );
}
