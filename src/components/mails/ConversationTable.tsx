import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import type { Conversation } from '../../contracts/conversation';
import { conversationSummary, fakeOfferStep, mailDate } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { DataTable, ROW_LINK_CLASS } from '../ui/data-table';
import { TodoState } from './TodoState';

function MailCell({ conversation }: { conversation: Conversation }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Link
        to="/mails/$key"
        params={{ key: conversation.key }}
        className={cn(ROW_LINK_CLASS, 'break-words', conversation.isNew && 'font-semibold')}
      >
        {conversation.subject || '(No subject)'}
      </Link>
      <span className="text-xs break-words text-text-secondary">
        {conversationSummary(conversation)}
      </span>
    </div>
  );
}

const column = (
  id: string,
  header: ReactNode,
  cell: (conversation: Conversation) => ReactNode,
  meta?: ColumnDef<Conversation>['meta'],
): ColumnDef<Conversation> => ({
  id,
  header: () => header,
  cell: ({ row }) => cell(row.original),
  meta,
});

// The application page lists its steps above, so here each conversation shows only its to-do state.
const COLUMNS: ColumnDef<Conversation>[] = [
  column('mail', 'Mail', (c) => <MailCell conversation={c} />, { count: true }),
  column(
    'todo',
    'To-do',
    (c) =>
      c.request ? (
        <TodoState state={c.request.state} fakeOffer={fakeOfferStep(c)} />
      ) : (
        <span className="text-xs text-text-secondary">None</span>
      ),
    { phoneLabel: 'To-do' },
  ),
  column(
    'last',
    'Last mail',
    (c) => <span className="text-xs">{mailDate(c.lastReceivedAt)}</span>,
    { phoneLabel: 'Last mail' },
  ),
];

/**
 * An application's own conversations, on its page: the mail, its to-do state and the last mail.
 * The Mails page has its own list (\`JobMails\`).
 */
export function ConversationTable({ conversations }: { conversations: Conversation[] }) {
  return (
    <DataTable
      label="Conversations"
      data={conversations}
      columns={COLUMNS}
      getRowId={(c) => c.key}
      gridTemplate="minmax(220px,1fr) 140px 112px"
    />
  );
}
