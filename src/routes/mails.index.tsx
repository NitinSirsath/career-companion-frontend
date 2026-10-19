import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { PageHeader } from '../components/layout/PageHeader';
import { GmailInbox } from '../components/mails/GmailInbox';
import { JobMails } from '../components/mails/JobMails';
import { MailsTabs } from '../components/mails/MailsTabs';
import { rememberListSearch } from '../lib/listMemory';
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

  // Remembered so the breadcrumb on a mail returns to this exact view.
  useEffect(() => rememberListSearch('/mails', search), [search]);

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        title="Mails"
        description="Every job mail, what it needs from you, and the application it belongs to."
      />
      <AIAccessNotice />
      <MailsTabs />
      {search.tab === 'gmail' ? <GmailInbox /> : <JobMails search={search} onChange={change} />}
    </div>
  );
}
