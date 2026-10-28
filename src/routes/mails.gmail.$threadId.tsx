import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMailThread } from '../api/mailbox';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { MailThreadView } from '../components/mails/MailThreadView';
import { MailTitle } from '../components/mails/MailTitle';

export const Route = createFileRoute('/mails/gmail/$threadId')({
  errorComponent: RouteErrorPage,
  component: GmailMailPage,
});

/** A mail opened from the Gmail tab that is not a job mail: the conversation only. */
function GmailMailPage() {
  const { threadId } = Route.useParams();
  const { data } = useMailThread(threadId);
  // Counts the header's Reply clicks; each one opens the reply box under the conversation.
  const [replyAsks, setReplyAsks] = useState(0);
  return (
    <div className="space-y-6">
      <MailTitle
        title={data ? data.subject || '(No subject)' : 'Mail'}
        threadId={threadId}
        onReply={() => setReplyAsks((asks) => asks + 1)}
        breadcrumb={
          <Breadcrumb current={data ? data.subject || '(No subject)' : undefined}>
            <Link to="/mails">Mails</Link>
            <Link to="/mails" search={{ tab: 'gmail' }}>
              Gmail
            </Link>
          </Breadcrumb>
        }
      >
        <span>From your Gmail inbox · read live · nothing stored</span>
      </MailTitle>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <MailThreadView threadId={threadId} replyAsks={replyAsks} />
        </div>
        <aside
          aria-label="About this mail"
          className="flex flex-col gap-3 border border-border-subtle bg-surface p-6 lg:sticky lg:top-20"
        >
          <h2 className="text-sm font-semibold">Not a job mail</h2>
          <p className="text-sm">
            This mail is shown as Gmail has it. NorthList did not analyze it and keeps nothing from
            it.
          </p>
        </aside>
      </div>
    </div>
  );
}
