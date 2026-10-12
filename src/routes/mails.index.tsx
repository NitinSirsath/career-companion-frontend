import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { GmailInbox } from '../components/mails/GmailInbox';
import { JobMails } from '../components/mails/JobMails';
import { MailsTabs } from '../components/mails/MailsTabs';
import { mailsSearchSchema, type MailsSearch } from '../lib/mails';

export const Route = createFileRoute('/mails/')({
  errorComponent: RouteErrorPage,
  validateSearch: mailsSearchSchema,
  component: MailsPage,
});

function MailsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  // Filters live in the URL, so Back from a mail returns to the same view.
  const change = (changes: Partial<MailsSearch>) =>
    void navigate({
      search: (current: MailsSearch) => ({ ...current, ...changes }),
      replace: true,
    });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Mails</h1>
        <p className="text-sm text-text-secondary">
          Every job mail, what it needs from you, and the application it belongs to.
        </p>
      </div>
      <AIAccessNotice />
      <MailsTabs />
      {search.tab === 'gmail' ? <GmailInbox /> : <JobMails search={search} onChange={change} />}
    </div>
  );
}
