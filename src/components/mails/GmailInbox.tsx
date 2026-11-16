import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { ChevronLeftIcon, ChevronRightIcon, InboxIcon } from 'lucide-react';
import { useGmailAddress, useMailboxThreads } from '../../api/mailbox';
import type { MailboxThread } from '../../contracts/mailbox';
import { mailDate, parseSender, snippetText } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { DataTable, ROW_LINK_CLASS } from '../ui/data-table';
import { PAGE_BUTTON } from '../ui/pagination';
import { EmptyState } from '../ui/empty-state';
import { InlineNotification } from '../ui/notification';
import { Tag } from '../ui/tag';
import { useIsPhone } from '../layout/useIsPhone';
import { MailboxProblem } from './MailboxProblem';
import { PhoneInboxList } from './PhoneInboxList';

/** A job mail opens with its job panel; any other mail opens as Gmail has it. */
function ThreadLink({ thread }: { thread: MailboxThread }) {
  const className = cn(ROW_LINK_CLASS, 'break-words', thread.unread && 'font-semibold');
  const subject = thread.subject || '(No subject)';
  return thread.conversationKey ? (
    <Link to="/mails/$key" params={{ key: thread.conversationKey }} className={className}>
      {subject}
    </Link>
  ) : (
    <Link to="/mails/gmail/$threadId" params={{ threadId: thread.threadId }} className={className}>
      {subject}
    </Link>
  );
}

const COLUMNS: ColumnDef<MailboxThread>[] = [
  {
    id: 'unread',
    header: () => <span className="sr-only">Unread</span>,
    cell: ({ row }) =>
      row.original.unread && (
        <span className="mt-1.5 block size-2 rounded-full bg-link">
          <span className="sr-only">Unread</span>
        </span>
      ),
    meta: { className: 'hidden md:block' },
  },
  {
    id: 'from',
    header: () => 'From',
    meta: { count: true },
    cell: ({ row }) => (
      <span className={cn('block truncate', row.original.unread && 'font-semibold')}>
        {parseSender(row.original.from).name}
        {row.original.messageCount > 1 && (
          <span className="font-normal text-text-secondary"> {row.original.messageCount}</span>
        )}
      </span>
    ),
  },
  {
    id: 'mail',
    header: () => 'Mail',
    cell: ({ row }) => (
      <span className="block">
        <ThreadLink thread={row.original} />
        {row.original.snippet && (
          <span className="text-text-secondary"> · {snippetText(row.original.snippet)}</span>
        )}
      </span>
    ),
  },
  {
    id: 'job',
    header: () => <span className="sr-only">Job mail</span>,
    cell: ({ row }) => row.original.conversationKey && <Tag color="outline">Job mail</Tag>,
  },
  {
    id: 'date',
    header: () => 'Date',
    cell: ({ row }) => (
      <span className={cn('text-xs', row.original.unread && 'font-semibold')}>
        {mailDate(row.original.date)}
      </span>
    ),
  },
];

 /** Under the list: Gmail's order, and the way to newer and older pages. */
function InboxPager({
  canGoBack,
  older,
  busy,
  onNewer,
  onOlder,
}: {
  canGoBack: boolean;
  /** The token of the next, older page; null on the last page. */
  older: string | null;
  busy: boolean;
  onNewer: () => void;
  onOlder: (token: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 pr-2 pl-4 max-md:pr-4 max-md:pl-5">
      <span className="text-xs text-text-secondary">Newest mail first, as in Gmail</span>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Newer"
          className={PAGE_BUTTON}
          disabled={!canGoBack || busy}
          onClick={onNewer}
        >
          <ChevronLeftIcon size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Older"
          className={PAGE_BUTTON}
          disabled={!older || busy}
          onClick={() => older && onOlder(older)}
        >
          <ChevronRightIcon size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** The Whole inbox tab: the user's inbox read live, nothing stored. */
export function GmailInbox() {
  // Gmail pages forward by token only, so the tokens walked so far are the way back.
  const [tokens, setTokens] = useState<string[]>([]);
  const { data, error, isLoading, isFetching, refetch } = useMailboxThreads(
    tokens[tokens.length - 1] ?? null,
  );
  const address = useGmailAddress();
  const phone = useIsPhone();
  const empty = data && <EmptyState icon={InboxIcon} title="No mail in this part of your inbox" />;
  const pager = (
    <InboxPager
      canGoBack={tokens.length > 0}
      older={data?.nextPageToken ?? null}
      busy={isFetching}
      onNewer={() => setTokens(tokens.slice(0, -1))}
      onOlder={(token) => setTokens([...tokens, token])}
    />
  );

  return (
    <div className="space-y-4">
      {/* On phones the list runs edge to edge; the notice keeps the page's side margin. */}
      <InlineNotification className="max-md:mx-4">
        Your inbox, read live from Gmail
        {address && (
          <>
            {' '}
            as <strong className="font-semibold">{address}</strong>
          </>
        )}
        . Nothing shown here is stored. Job mails open their conversation; the others open as plain
        mail.
      </InlineNotification>
      {error && <MailboxProblem error={error} onRetry={() => void refetch()} />}
      {!error && phone && (
        <PhoneInboxList threads={data?.items} loading={isLoading} empty={empty} footer={pager} />
      )}
      {!error && !phone && (
        <DataTable
          label="Whole inbox"
          data={data?.items ?? []}
          columns={COLUMNS}
          getRowId={(thread) => thread.threadId}
          gridTemplate="8px minmax(140px,220px) minmax(0,1fr) 96px 112px"
          loading={isLoading}
          empty={empty}
          footer={pager}
        />
      )}
    </div>
  );
}
