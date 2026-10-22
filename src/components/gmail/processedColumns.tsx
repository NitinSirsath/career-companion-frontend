import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Launch } from '@carbon/icons-react';
import { format } from 'date-fns';
import type { EmailMessage } from '../../contracts/gmail';
import { getGmailConversationUrl } from '../../utils/gmail';
import { MatchCorrectionDialog } from '../MatchCorrectionDialog';

/** What the app made of a mail, in words instead of the stored state. */
const RESULT: Record<EmailMessage['relevanceState'], string> = {
  RELEVANT: 'Job mail',
  IRRELEVANT: 'Not a job mail',
  UNPROCESSED: 'Not read yet',
};

function ApplicationCell({ msg }: { msg: EmailMessage }) {
  let link: ReactNode;
  if (msg.application)
    link = (
      <span>
        <Link to="/applications/$id" params={{ id: msg.application.id }} className="text-link">
          {msg.application.companyName}
        </Link>{' '}
        <span className="text-xs text-text-secondary">
          {msg.matchConfirmedBy === 'USER_CONFIRMED' ? 'by you' : 'by the app'}
        </span>
      </span>
    );
  else if (msg.matchState === 'IGNORED') link = 'Ignored';
  else if (msg.matchState === 'AMBIGUOUS') link = 'Needs review';
  else if (msg.relevanceState === 'RELEVANT') link = 'Not linked';
  else link = <span className="text-text-tertiary">None</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {link}
      {(msg.matchState === 'MATCHED' || msg.matchState === 'IGNORED') && (
        <MatchCorrectionDialog
          emailId={msg.id}
          matchState={msg.matchState}
          applicationId={msg.applicationId ?? null}
        />
      )}
    </div>
  );
}

/** The columns of the Gmail sync list: the mail, what the app made of it, and the AI's state. */
export function processedColumns({
  devMode,
  renderAI,
}: {
  devMode: boolean;
  renderAI: (msg: EmailMessage) => ReactNode;
}): ColumnDef<EmailMessage>[] {
  return [
    {
      id: 'subject',
      header: () => 'Mail',
      meta: { count: true },
      cell: ({ row }) => {
        const msg = row.original;
        const subject = msg.subject || '(No subject)';
        if (!msg.threadId || devMode) return <span className="break-words">{subject}</span>;
        return (
          <a
            href={getGmailConversationUrl(msg.threadId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 break-words text-link"
            aria-label={`Open email "${subject}" in Gmail`}
          >
            {subject}
            <Launch size={12} className="shrink-0" aria-hidden="true" />
          </a>
        );
      },
    },
    {
      id: 'sender',
      header: () => 'From',
      meta: { phoneLabel: 'From' },
      cell: ({ row }) => (
        <span className="block truncate text-text-secondary" title={row.original.sender || ''}>
          {row.original.sender || 'Unknown'}
        </span>
      ),
    },
    {
      id: 'result',
      header: () => 'Result',
      meta: { phoneLabel: 'Result' },
      cell: ({ row }) => RESULT[row.original.relevanceState],
    },
    {
      id: 'application',
      header: () => 'Application',
      meta: { phoneLabel: 'Application' },
      cell: ({ row }) => <ApplicationCell msg={row.original} />,
    },
    {
      id: 'ai',
      header: () => 'AI',
      meta: { phoneLabel: 'AI' },
      cell: ({ row }) => renderAI(row.original),
    },
    {
      id: 'received',
      header: () => 'Received',
      meta: { phoneLabel: 'Received' },
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.receivedAt
            ? format(new Date(row.original.receivedAt), 'MMM d, yyyy')
            : 'Unknown'}
        </span>
      ),
    },
  ];
}
