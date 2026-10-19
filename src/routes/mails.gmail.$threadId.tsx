import { createFileRoute, Link } from '@tanstack/react-router';
import { useMailThread } from '../api/mailbox';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { Breadcrumb } from '../components/layout/PageHeader';
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
  return (
    <div className="space-y-6">
      <MailTitle
        title={data ? data.subject || '(No subject)' : 'Mail'}
        threadId={threadId}
        breadcrumb={
          <Breadcrumb>
            <Link to="/mails">Mails</Link>
            <Link to="/mails" search={{ tab: 'gmail' }}>
              Gmail
            </Link>
          </Breadcrumb>
        }
      >
        <span>From your Gmail inbox · read live · nothing stored</span>
      </MailTitle>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 min-w-0">
          <MailThreadView threadId={threadId} />
        </div>
        <aside aria-label="About this mail" className="border border-border-default p-4 space-y-2">
          <h2 className="text-xs font-semibold text-text-secondary">Not a job mail</h2>
          <p className="text-sm">
            This mail is shown as Gmail has it. Career Companion did not analyze it and keeps
            nothing from it.
          </p>
        </aside>
      </div>
    </div>
  );
}
