import { useState } from 'react';
import { Search } from '@carbon/icons-react';
import type { MailsSearch } from '../../lib/mails';
import { TopBarActions } from '../layout/Breadcrumb';
import { TopBarButton } from '../layout/TopBarButtons';
import { MailFilterChips, MailTools, PhoneMailSearch } from './ConversationFilters';
import { MailsTabs } from './MailsTabs';

type BarProps = { search: MailsSearch; onChange: (changes: Partial<MailsSearch>) => void };

/** Laptops: tabs, search, Filters and Sort on one line that stays on screen, then the chips. */
export function LaptopBar({
  tab,
  search,
  onChange,
}: BarProps & { tab: 'job' | 'gmail' | 'restricted' }) {
  return (
    <div className="sticky top-14 z-20 -mx-12 mt-4 bg-background px-12 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-border-subtle">
        <MailsTabs tab={tab} />
        {!search.tab && <MailTools search={search} onChange={onChange} />}
      </div>
      {!search.tab && <MailFilterChips search={search} onChange={onChange} />}
    </div>
  );
}

/** Phones: the top bar's search button, and the search row it opens under the top bar. */
export function PhoneSearch({ search, onChange }: BarProps) {
  const [searching, setSearching] = useState(false);
  if (searching)
    return (
      <div className="sticky top-14 z-20 -mx-4 border-b border-border-subtle bg-background px-4 py-2">
        <PhoneMailSearch search={search} onChange={onChange} onClose={() => setSearching(false)} />
      </div>
    );
  return (
    <TopBarActions>
      <TopBarButton label="Search mails" onClick={() => setSearching(true)}>
        <Search size={20} aria-hidden="true" />
      </TopBarButton>
    </TopBarActions>
  );
}
