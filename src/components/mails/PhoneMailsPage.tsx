import { AIAccessNotice } from '../ai/AIAccessNotice';
import { useConversations } from '../../api/conversations';
import { filtersFromSearch, type MailsSearch } from '../../lib/mails';
import { GmailInbox } from './GmailInbox';
import { JobMails } from './JobMails';
import { PhoneMailsTools } from './MailsBars';
import { MailsPhoneTitle } from './MailsPhoneTitle';
import { MailSummary } from './MailSummary';
import type { MailsTab } from './mailsLists';
import { RestrictedList } from './RestrictedList';

/**
 * The Mails page on phones (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): "Job mails ⌄" as
 * the big title with the status line under it, the tools in the glass capsule, the filters in use
 * as pills, then the mails edge to edge and the day's summary under them.
 */
export function PhoneMailsPage({
  search,
  tab,
  onFilter,
  onChange,
}: {
  search: MailsSearch;
  tab: MailsTab;
  /** A filter change: the list starts again at its first page. */
  onFilter: (changes: Partial<MailsSearch>) => void;
  onChange: (changes: Partial<MailsSearch>) => void;
}) {
  const needsActionOn = search.request === 'open';
  // The same list JobMails shows (one shared request): with no rows, its empty state says it all.
  const list = useConversations(filtersFromSearch(search), search.offset ?? 0);
  const emptyList = list.data?.items.length === 0;
  return (
    <div>
      <MailsPhoneTitle tab={tab} />
      <PhoneMailsTools search={search} onChange={onFilter} />
      <div className="mt-2 empty:hidden">
        <AIAccessNotice compact />
      </div>
      <div className="phone-bleed mt-1">
        {search.tab === 'gmail' && <GmailInbox />}
        {search.tab === 'restricted' && <RestrictedList />}
        {!search.tab && <JobMails search={search} onChange={onChange} />}
      </div>
      {!search.tab && !emptyList && (
        <p className="px-1 pt-3.5 text-[13px] leading-[18px] text-text-tertiary">
          <MailSummary
            needsActionOn={needsActionOn}
            onToggleNeedsAction={() => onFilter({ request: needsActionOn ? undefined : 'open' })}
          />
        </p>
      )}
    </div>
  );
}
