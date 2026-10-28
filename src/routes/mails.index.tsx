import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { TopBarActions } from '../components/layout/Breadcrumb';
import { PageHeader } from '../components/layout/PageHeader';
import { TopBarSearch } from '../components/layout/TopBarButtons';
import { useIsPhone } from '../components/layout/useIsPhone';
import { MAIL_SEARCH_ID } from '../components/mails/ConversationFilters';
import { GmailInbox } from '../components/mails/GmailInbox';
import { JobMails } from '../components/mails/JobMails';
import { MailsTabs } from '../components/mails/MailsTabs';
import { RestrictedList } from '../components/mails/RestrictedList';
import { SyncLine } from '../components/mails/SyncLine';
import { rememberListSearch } from '../lib/listMemory';
import { mailsSearchSchema, type MailsSearch } from '../lib/mails';

export const Route = createFileRoute('/mails/')({
  errorComponent: RouteErrorPage,
  validateSearch: mailsSearchSchema,
  component: MailsPage,
});

function MailsPage() {
  const search = Route.useSearch();
  const phone = useIsPhone();
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
        phoneCompact
        title="Mails"
        description="Every job mail, what it needs from you, and the application it belongs to."
        actions={phone ? undefined : <SyncLine />}
      />
      {phone && !search.tab && (
        <TopBarActions>
          <TopBarSearch targetId={MAIL_SEARCH_ID} label="Search mails" />
        </TopBarActions>
      )}
      <AIAccessNotice />
      <MailsTabs tab={search.tab ?? 'job'} />
      {phone && <SyncLine compact />}
      {search.tab === 'gmail' && <GmailInbox />}
      {search.tab === 'restricted' && <RestrictedList />}
      {!search.tab && <JobMails search={search} onChange={change} />}
    </div>
  );
}
