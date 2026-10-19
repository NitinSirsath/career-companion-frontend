import { Link } from '@tanstack/react-router';
import type { Conversation } from '../../contracts/conversation';
import { CATEGORY_LABEL, conversationSummary, mailDate } from '../../lib/mails';
import { Tag } from '../ui/tag';
import { ConversationAction } from './ConversationAction';
import { ConversationApplication } from './ConversationApplication';

const headClass = 'px-4 py-3 text-xs font-semibold text-text-secondary';
// On a phone every cell is a block, so a row reads top to bottom instead of being squeezed.
const cellClass = 'block xl:table-cell px-4 py-2 xl:py-3 align-top';

interface ConversationTableProps {
  conversations: Conversation[];
  /** The application page: its own conversations, shown without the column and the buttons. */
  compact?: boolean;
}

/** One row per job-mail conversation: the mail, what it needs, and its application. */
export function ConversationTable({ conversations, compact = false }: ConversationTableProps) {
  return (
    <div className="border border-border-default">
      <table className="block xl:table w-full border-collapse text-left text-sm">
        <thead className="hidden xl:table-header-group bg-surface-subtle">
          <tr className="border-b border-border-default">
            <th scope="col" className={headClass}>
              Mail
            </th>
            <th scope="col" className={headClass}>
              Type
            </th>
            <th scope="col" className={headClass}>
              Action
            </th>
            {!compact && (
              <th scope="col" className={headClass}>
                Application
              </th>
            )}
            <th scope="col" className={headClass}>
              Last mail
            </th>
          </tr>
        </thead>
        <tbody className="block xl:table-row-group">
          {conversations.map((conversation) => (
            <ConversationRow key={conversation.key} conversation={conversation} compact={compact} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversationRow({
  conversation,
  compact,
}: {
  conversation: Conversation;
  compact: boolean;
}) {
  return (
    <tr className="block xl:table-row py-2 xl:py-0 border-b border-border-subtle last:border-b-0">
      <td className={cellClass}>
        <div className="flex flex-wrap items-center gap-2">
          {conversation.isNew && <Tag color="blue">New</Tag>}
          <Link
            to="/mails/$key"
            params={{ key: conversation.key }}
            className="font-semibold text-text-primary underline break-words hover:text-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            {conversation.subject || '(No subject)'}
          </Link>
        </div>
        <p className="mt-1 text-xs text-text-secondary break-words">
          {conversationSummary(conversation)}
        </p>
      </td>
      <td className={cellClass}>
        {conversation.category && (
          <Tag color="outline">{CATEGORY_LABEL[conversation.category]}</Tag>
        )}
      </td>
      <td className={cellClass}>
        <ConversationAction conversation={conversation} controls={!compact} />
      </td>
      {!compact && (
        <td className={cellClass}>
          <ConversationApplication conversation={conversation} />
        </td>
      )}
      <td className={`${cellClass} text-text-secondary xl:whitespace-nowrap`}>
        <span className="xl:hidden">Last mail: </span>
        {mailDate(conversation.lastReceivedAt)}
      </td>
    </tr>
  );
}
