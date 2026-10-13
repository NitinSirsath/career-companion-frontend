import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useSandboxThreads } from '../../api/sandbox';
import type { SandboxFolder, SandboxThread } from '../../contracts/sandbox';
import { mailDate, parseSender } from '../../lib/mails';
import { sandboxProblem, threadMark } from '../../lib/sandbox';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

function ThreadRow({ thread, folder }: { thread: SandboxThread; folder: SandboxFolder }) {
  const mark = threadMark(thread);
  return (
    <Link
      to="/sandbox/$threadId"
      params={{ threadId: thread.threadId }}
      // One line only on a wide screen: the folder list and the app menu leave little room.
      className="flex flex-col gap-1 px-4 py-3 text-sm text-text-primary transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus xl:flex-row xl:items-baseline xl:gap-4"
    >
      <span className="shrink-0 font-medium xl:w-44 xl:truncate">
        {folder === 'sent' && <span className="text-text-secondary">To: </span>}
        {parseSender(thread.party).name}
        {thread.messageCount > 1 && (
          <span className="text-text-secondary"> {thread.messageCount}</span>
        )}
      </span>
      <span className="min-w-0 flex-1 break-words">
        {thread.subject || '(No subject)'}
        <span className="text-text-secondary"> · {thread.snippet}</span>
      </span>
      <Badge variant={mark.variant} className="self-start whitespace-nowrap xl:self-auto">
        {mark.label}
      </Badge>
      <span className="shrink-0 text-text-secondary xl:w-28 xl:text-right">
        {mailDate(thread.date)}
      </span>
    </Link>
  );
}

const EMPTY: Record<SandboxFolder, string> = {
  inbox: 'No mail yet. Compose a mail to yourself from any address, then sync.',
  sent: 'No replies yet. Open a conversation and reply.',
};

/** The conversations of one sandbox folder, newest first. */
export function SandboxThreadList({ folder }: { folder: SandboxFolder }) {
  // Pages go forward by token only, so the tokens walked so far are the way back.
  const [tokens, setTokens] = useState<string[]>([]);
  const { data, error, isLoading } = useSandboxThreads(folder, tokens[tokens.length - 1] ?? null);
  const older = data?.nextPageToken ?? null;

  return (
    <section aria-label={folder === 'inbox' ? 'Inbox' : 'Sent'} className="space-y-4">
      {isLoading && (
        <p role="status" className="text-sm text-text-secondary">
          Reading the sandbox mailbox…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-status-error">
          {sandboxProblem(error)}
        </p>
      )}
      {data && data.items.length === 0 && (
        <p className="border border-dashed border-border-strong p-6 text-sm text-text-secondary">
          {EMPTY[folder]}
        </p>
      )}
      {data && data.items.length > 0 && (
        <ul className="divide-y divide-border-subtle border border-border-default">
          {data.items.map((thread) => (
            <li key={thread.threadId}>
              <ThreadRow thread={thread} folder={folder} />
            </li>
          ))}
        </ul>
      )}
      {(tokens.length > 0 || older) && (
        <div className="flex justify-end gap-2">
          <Button
            variant="tertiary"
            size="sm"
            disabled={tokens.length === 0}
            onClick={() => setTokens(tokens.slice(0, -1))}
          >
            Newer
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            disabled={!older}
            onClick={() => older && setTokens([...tokens, older])}
          >
            Older
          </Button>
        </div>
      )}
    </section>
  );
}
