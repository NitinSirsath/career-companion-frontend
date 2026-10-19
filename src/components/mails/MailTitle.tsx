import type { ReactNode } from 'react';
import { PageHeader } from '../layout/PageHeader';
import { GmailLink } from '../ui/GmailLink';

interface MailTitleProps {
  title: string;
  /** Null when Gmail gave the mail no conversation to open. */
  threadId: string | null;
  breadcrumb: ReactNode;
  /** The line under the title: what kind of mail this is. */
  children: ReactNode;
}

/** The top of a mail's details page: where it sits, its subject, one line about it, Gmail. */
export function MailTitle({ title, threadId, breadcrumb, children }: MailTitleProps) {
  return (
    <PageHeader
      className="mb-0"
      breadcrumb={breadcrumb}
      title={title}
      meta={
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          {children}
        </div>
      }
      actions={<GmailLink threadId={threadId} subject={title} />}
    />
  );
}
