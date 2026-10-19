import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useGmailAddress, useMailboxThreads } from '../../api/mailbox';
import type { MailboxThread } from '../../contracts/mailbox';
import { mailDate, parseSender, snippetText } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { Tag } from '../ui/tag';
import { Button } from '../ui/button';
import { MailboxProblem } from './MailboxProblem';

const rowClass =
  'flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4 px-4 py-3 text-sm text-text-primary hover:bg-surface-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus';

/** One thread of the inbox. Unread mail is bold, as in Gmail. */
function ThreadRow({ thread }: { thread: MailboxThread }) {
  const strong = thread.unread ? 'font-semibold' : '';
  const content = (
    <>
      <span className={cn('sm:w-48 shrink-0 sm:truncate', strong)}>
        {parseSender(thread.from).name}
        {thread.messageCount > 1 && (
          <span className="font-normal text-text-secondary"> {thread.messageCount}</span>
        )}
      </span>
      <span className="flex-1 min-w-0 break-words">
        <span className={strong}>{thread.subject || '(No subject)'}</span>
        {thread.snippet && (
          <span className="text-text-secondary"> · {snippetText(thread.snippet)}</span>
        )}
      </span>
      {thread.conversationKey && (
        <Tag color="blue" className="self-start sm:self-auto">
          Job mail
        </Tag>
      )}
      <span className={cn('shrink-0 sm:w-28 sm:text-right', strong || 'text-text-secondary')}>
        {mailDate(thread.date)}
      </span>
    </>
  );
  // A job mail opens with its job panel; any other mail opens as Gmail has it.
  return thread.conversationKey ? (
    <Link to="/mails/$key" params={{ key: thread.conversationKey }} className={rowClass}>
      {content}
    </Link>
  ) : (
    <Link to="/mails/gmail/$threadId" params={{ threadId: thread.threadId }} className={rowClass}>
      {content}
    </Link>
  );
}

/** The Gmail tab: the user's inbox read live. Reading only: no filters, no search, no actions. */
export function GmailInbox() {
  // Gmail pages forward by token only, so the tokens walked so far are the way back.
  const [tokens, setTokens] = useState<string[]>([]);
  const { data, error, isLoading, isFetching, refetch } = useMailboxThreads(
    tokens[tokens.length - 1] ?? null,
  );
  const address = useGmailAddress();
  const older = data?.nextPageToken ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-surface-subtle px-4 py-3 text-sm">
        <span>
          Your inbox, read live from Gmail
          {address && (
            <>
              {' '}
              as <strong className="font-semibold">{address}</strong>
            </>
          )}
          . Nothing shown here is stored.
        </span>
        <span className="text-text-secondary">Reading only. To reply, open the mail in Gmail.</span>
      </div>
      {isLoading && (
        <p role="status" className="text-sm text-text-secondary">
          Reading your inbox from Gmail…
        </p>
      )}
      {error && <MailboxProblem error={error} onRetry={() => void refetch()} />}
      {data && data.items.length === 0 && (
        <p className="border border-border-default bg-surface-subtle p-8 text-center text-sm">
          No mail in this part of your inbox.
        </p>
      )}
      {data && data.items.length > 0 && (
        <ul className="border border-border-default divide-y divide-border-subtle">
          {data.items.map((thread) => (
            <li key={thread.threadId}>
              <ThreadRow thread={thread} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between gap-3 text-sm text-text-secondary">
        <Button
          variant="tertiary"
          size="sm"
          disabled={tokens.length === 0 || isFetching}
          onClick={() => setTokens(tokens.slice(0, -1))}
        >
          Newer
        </Button>
        <span className="text-center">Newest mail first, as in Gmail</span>
        <Button
          variant="tertiary"
          size="sm"
          disabled={!older || isFetching}
          onClick={() => older && setTokens([...tokens, older])}
        >
          Older
        </Button>
      </div>
    </div>
  );
}
