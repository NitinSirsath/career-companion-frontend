import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Launch, Reply } from '@carbon/icons-react';
import { useSandboxMailbox } from '../../api/appMode';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../ui/button';
import { GmailLink } from '../ui/GmailLink';

interface MailTitleProps {
  title: string;
  /** Null when Gmail gave the mail no conversation to open. */
  threadId: string | null;
  breadcrumb: ReactNode;
  /** The facts under the title: the company, the role, the status and how many mails. */
  children: ReactNode;
  /** Opens the reply box under the conversation. */
  onReply?: () => void;
}

/** Where the conversation lives: Gmail in prod, the mail sandbox in dev mode. */
function MailboxLink({ threadId, subject }: { threadId: string; subject: string }) {
  const sandbox = useSandboxMailbox();
  if (!sandbox) return <GmailLink threadId={threadId} subject={subject} className="text-sm" />;
  return (
    <Link
      to="/sandbox/$threadId"
      params={{ threadId }}
      className="inline-flex items-center gap-1.5 text-sm text-link hover:underline"
    >
      Open in the mail sandbox
      <Launch size={14} aria-hidden="true" />
    </Link>
  );
}

/**
 * The top of a mail's details page: its subject, a row of facts, the way to its mailbox, and the
 * Reply button.
 */
export function MailTitle({ title, threadId, breadcrumb, children, onReply }: MailTitleProps) {
  return (
    <PageHeader
      className="mb-0"
      breadcrumb={breadcrumb}
      title={title}
      meta={
        <div className="mt-2 flex flex-col items-start gap-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-text-secondary">
            {children}
          </div>
          {threadId && <MailboxLink threadId={threadId} subject={title} />}
        </div>
      }
      actions={
        threadId &&
        onReply && (
          <Button onClick={onReply}>
            <Reply size={16} aria-hidden="true" />
            Reply
          </Button>
        )
      }
    />
  );
}
