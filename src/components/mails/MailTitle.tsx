import type { ReactNode } from 'react';
import { GmailLink } from '../ui/GmailLink';

interface MailTitleProps {
  title: string;
  /** Null when Gmail gave the mail no conversation to open. */
  threadId: string | null;
  /** The line under the title: what kind of mail this is. */
  children: ReactNode;
}

/** The top of a mail's details page: its subject, one line about it, and the way to Gmail. */
export function MailTitle({ title, threadId, children }: MailTitleProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
          {children}
        </div>
      </div>
      <GmailLink threadId={threadId} subject={title} />
    </div>
  );
}
