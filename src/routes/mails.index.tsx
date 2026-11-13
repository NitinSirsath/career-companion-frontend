import { useEffect } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { PageHeader } from '../components/layout/PageHeader';
import { useIsPhone } from '../components/layout/useIsPhone';
import { PhoneMailChips } from '../components/mails/ConversationFilters';
import { LaptopBar, PhoneSearch } from '../components/mails/MailsBars';
import { GmailInbox } from '../components/mails/GmailInbox';
import { JobMails } from '../components/mails/JobMails';
import { MailsPhoneTitle } from '../components/mails/MailsPhoneTitle';
import { MailSummary } from '../components/mails/MailSummary';
import { RestrictedList } from '../components/mails/RestrictedList';
import { SyncLine } from '../components/mails/SyncLine';
import { rememberListSearch } from '../lib/listMemory';
import { mailsSearchSchema, type MailsSearch } from '../lib/mails';

export const Route = createFileRoute('/mails/')({
  errorComponent: RouteErrorPage,
  validateSearch: mailsSearchSchema,
  component: MailsPage,
});

/**
 * The Mails page (owner, 3 Nov 2026): the title with "4 mails need you, 2 are past due", a slim AI
 * notice, then the lists. Laptops: tabs, search, Filters and Sort on one line that stays on screen.
 * Phones: the lists switch in the top bar title, the top bar's search button opens a search row
 * under it, and one row of chips sits above the mails.
 */
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
  // A changed filter starts again at the first page.
  const filter = (changes: Partial<MailsSearch>) => change({ ...changes, offset: undefined });
  const tab = search.tab ?? 'job';
  const needsActionOn = search.request === 'open';

  // Remembered so the breadcrumb on a mail returns to this exact view.
  useEffect(() => rememberListSearch('/mails', search), [search]);

  return (
    <div>
      <PageHeader
        phoneCompact
        title="Mails"
        description={
          !search.tab && (
            <MailSummary
              needsActionOn={needsActionOn}
              onToggleNeedsAction={() => filter({ request: needsActionOn ? undefined : 'open' })}
            />
          )
        }
        actions={phone ? undefined : <SyncLine />}
      />
      {phone && <MailsPhoneTitle tab={tab} />}
      {phone && !search.tab && <PhoneSearch search={search} onChange={filter} />}
      <div className="mt-5 empty:hidden max-md:mt-3 md:mb-6">
        <AIAccessNotice compact />
      </div>
      <LaptopBar tab={tab} search={search} onChange={change} />
      <div className="mt-1">
        {search.tab === 'gmail' && <GmailInbox />}
        {search.tab === 'restricted' && <RestrictedList />}
        {!search.tab && <JobMails search={search} onChange={change} />}
      </div>
    </div>
  );
}
