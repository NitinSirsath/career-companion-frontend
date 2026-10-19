import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useSetRequestState } from '../../api/conversations';
import { useDevMode } from '../../api/appMode';
import type { Conversation } from '../../contracts/conversation';
import { conversationSummary, mailDate, requestControls, requestTitle } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { getGmailConversationUrl } from '../../utils/gmail';
import { DataTable, ROW_LINK_CLASS } from '../ui/data-table';
import { OverflowMenu, type MenuAction } from '../ui/menu';
import { showToast } from '../ui/toast';
import { ConversationAction } from './ConversationAction';
import { ConversationApplication } from './ConversationApplication';
import { MailType } from './MailType';

/** The row's "…" menu: change what the mail needs, and open it in Gmail. */
function RowMenu({ conversation }: { conversation: Conversation }) {
  const change = useSetRequestState(conversation.key);
  const devMode = useDevMode();
  const asked = conversation.request;
  const actions: MenuAction[] = [];
  if (asked) {
    const title = requestTitle(asked);
    // The server can set a request back to open or done, not to replied: no Undo from replied.
    const before = asked.state === 'REPLIED' ? null : asked.state;
    for (const control of requestControls(asked.state, true)) {
      actions.push({
        label: control.label,
        disabled: change.isPending,
        onSelect: () =>
          change.mutate(
            { emailId: asked.emailId, state: control.state },
            {
              onSuccess: () =>
                showToast(
                  `${control.label === 'Mark done' ? 'Marked done' : 'Updated'}: ${title}`,
                  {
                    undo: before
                      ? () => change.mutate({ emailId: asked.emailId, state: before })
                      : undefined,
                  },
                ),
            },
          ),
      });
    }
  }
  if (conversation.threadId && !devMode) {
    const url = getGmailConversationUrl(conversation.threadId);
    actions.push({
      label: 'Open in Gmail',
      onSelect: () => window.open(url, '_blank', 'noopener'),
    });
  }
  if (actions.length === 0) return null;
  return (
    <OverflowMenu label={`Actions for ${conversation.subject || 'this mail'}`} actions={actions} />
  );
}

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
      <span className="text-xs tracking-[0.32px] break-words text-text-secondary">
        {conversationSummary(conversation)}
      </span>
    </div>
  );
}

function NewDot({ isNew }: { isNew: boolean }) {
  if (!isNew) return null;
  return (
    <span className="mt-1.5 block size-2 rounded-full bg-link">
      <span className="sr-only">New</span>
    </span>
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

const FULL_COLUMNS: ColumnDef<Conversation>[] = [
  column('new', <span className="sr-only">New</span>, (c) => <NewDot isNew={c.isNew} />, {
    className: 'hidden md:block',
  }),
  column('mail', 'Mail', (c) => <MailCell conversation={c} />),
  column('type', 'Type', (c) => c.category && <MailType category={c.category} />),
  column('step', 'Next step', (c) => <ConversationAction conversation={c} controls={false} />, {
    sortKey: 'needs',
  }),
  column(
    'application',
    'Application',
    (c) => <ConversationApplication conversation={c} appearance="cell" />,
    {
      interactive: true,
      phoneLabel: 'Application',
    },
  ),
  column(
    'last',
    'Last mail',
    (c) => <span className="text-xs tracking-[0.32px]">{mailDate(c.lastReceivedAt)}</span>,
    { sortKey: 'newest', phoneLabel: 'Last mail' },
  ),
  column('menu', <span className="sr-only">Actions</span>, (c) => <RowMenu conversation={c} />, {
    interactive: true,
    className: 'md:-my-1.5 md:justify-self-end',
  }),
];

const COMPACT_COLUMNS: ColumnDef<Conversation>[] = [
  column('mail', 'Mail', (c) => <MailCell conversation={c} />),
  column('step', 'Next step', (c) => <ConversationAction conversation={c} controls={false} />),
  column(
    'last',
    'Last mail',
    (c) => <span className="text-xs tracking-[0.32px]">{mailDate(c.lastReceivedAt)}</span>,
    { phoneLabel: 'Last mail' },
  ),
];

interface ConversationTableProps {
  conversations: Conversation[];
  /** The application page: its own conversations, without the application column and menu. */
  compact?: boolean;
  sort?: { active: string; onSort: (key: string) => void };
  loading?: boolean;
  empty?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
}

/** One row per job-mail conversation: the mail, what it needs, and its application. */
export function ConversationTable({
  conversations,
  compact = false,
  ...rest
}: ConversationTableProps) {
  return (
    <DataTable
      label={compact ? 'Conversations' : 'Job mails'}
      data={conversations}
      columns={compact ? COMPACT_COLUMNS : FULL_COLUMNS}
      getRowId={(c) => c.key}
      gridTemplate={
        compact
          ? 'minmax(220px,2fr) minmax(200px,2fr) 112px'
          : '8px minmax(220px,2.2fr) 120px minmax(220px,2fr) minmax(170px,1.4fr) 112px 32px'
      }
      {...rest}
    />
  );
}
