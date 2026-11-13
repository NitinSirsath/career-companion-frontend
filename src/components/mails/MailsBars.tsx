import { useState } from 'react';
import { Menu } from '@base-ui/react/menu';
import { CheckIcon, SearchIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useGmailStatus, useSyncNow } from '../../api/gmail';
import type { MailsSearch } from '../../lib/mails';
import { cn } from '../../lib/utils';
import { TopBarActions } from '../layout/Breadcrumb';
import { CapsuleButton, GlassCapsule } from '../phone/GlassButton';
import { PhoneRefresh } from '../phone/PhoneRefresh';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';
import {
  MailFilterChips,
  MailFilterPills,
  MailFiltersSheet,
  MailTools,
  PhoneMailSearch,
} from './ConversationFilters';
import { MailsTabs } from './MailsTabs';

type BarProps = { search: MailsSearch; onChange: (changes: Partial<MailsSearch>) => void };

/**
 * Laptops: tabs, search, Filters and Sort on one line that stays on screen, then the chips. The top
 * padding is only for when it sticks under the top bar, so it is pulled up by the same amount.
 */
export function LaptopBar({
  tab,
  search,
  onChange,
}: BarProps & { tab: 'job' | 'gmail' | 'restricted' }) {
  return (
    <div className="sticky top-14 z-20 -mx-12 -mt-3 bg-background px-12 pt-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-border-subtle">
        <MailsTabs tab={tab} />
        {!search.tab && <MailTools search={search} onChange={onChange} />}
      </div>
      {!search.tab && <MailFilterChips search={search} onChange={onChange} />}
    </div>
  );
}

/** The filters menu in the capsule: the quick ones, the order, and the way to every filter. */
function PhoneFilterMenu({ search, onChange, onAll }: BarProps & { onAll: () => void }) {
  const toggle = (on: boolean, changes: Partial<MailsSearch>, off: Partial<MailsSearch>) =>
    onChange(on ? changes : off);
  return (
    <Menu.Root>
      <Menu.Trigger render={<CapsuleButton label="Filter and sort" />}>
        <SlidersHorizontalIcon size={22} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} className="z-50 outline-none">
          <Menu.Popup className={cn(POPUP_CLASS, 'phone-type min-w-60 rounded-[18px]')}>
            <QuickFilter
              label="Needs action"
              checked={search.request === 'open'}
              onChange={(on) => toggle(on, { request: 'open' }, { request: undefined })}
            />
            <QuickFilter
              label="New only"
              checked={search.unseen === true}
              onChange={(on) => toggle(on, { unseen: true }, { unseen: undefined })}
            />
            <QuickFilter
              label="From recruiters"
              checked={search.category === 'RECRUITER'}
              onChange={(on) => toggle(on, { category: 'RECRUITER' }, { category: undefined })}
            />
            <Menu.Separator className="my-1 h-px bg-border-subtle" />
            <Menu.RadioGroup
              value={search.sort === 'attention' ? 'attention' : 'newest'}
              onValueChange={(next) =>
                onChange({ sort: next === 'attention' ? 'attention' : undefined })
              }
            >
              <SortItem value="newest" label="Newest first" />
              <SortItem value="attention" label="Needs action first" />
            </Menu.RadioGroup>
            <Menu.Separator className="my-1 h-px bg-border-subtle" />
            <Menu.Item
              className={cn(ITEM_CLASS, 'justify-start gap-3 pl-11 text-[17px]')}
              onClick={onAll}
            >
              All filters…
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

const MENU_ROW = cn(ITEM_CLASS, 'min-h-11 justify-start gap-3 text-[17px]');

function QuickFilter({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Menu.CheckboxItem checked={checked} onCheckedChange={onChange} className={MENU_ROW}>
      <span className="flex w-[18px] text-text-primary">
        <Menu.CheckboxItemIndicator>
          <CheckIcon size={18} aria-hidden="true" />
        </Menu.CheckboxItemIndicator>
      </span>
      {label}
    </Menu.CheckboxItem>
  );
}

function SortItem({ value, label }: { value: string; label: string }) {
  return (
    <Menu.RadioItem value={value} className={MENU_ROW}>
      <span className="flex w-[18px] text-text-primary">
        <Menu.RadioItemIndicator>
          <CheckIcon size={18} aria-hidden="true" />
        </Menu.RadioItemIndicator>
      </span>
      {label}
    </Menu.RadioItem>
  );
}

/**
 * Phones (owner, 13 Nov 2026, approved mock \`IOS-LOOK-mock/\`): refresh, search and filters in one
 * round glass capsule at the top right. Under the title: the search row once opened, and the
 * filters in use as small pills. Refresh also asks Gmail for new mail.
 */
export function PhoneMailsTools({ search, onChange }: BarProps) {
  const [searching, setSearching] = useState(!!search.q);
  const [allFilters, setAllFilters] = useState(false);
  const gmail = useGmailStatus();
  const sync = useSyncNow();
  // The whole inbox and the restricted list have no search or filters of their own.
  const job = !search.tab;
  return (
    <>
      <TopBarActions>
        <GlassCapsule label="Mail tools">
          <PhoneRefresh also={() => gmail.data?.connected && sync.mutate()} />
          {job && (
            <CapsuleButton label="Search mails" onClick={() => setSearching(true)}>
              <SearchIcon size={22} aria-hidden="true" />
            </CapsuleButton>
          )}
          {job && (
            <PhoneFilterMenu
              search={search}
              onChange={onChange}
              onAll={() => setAllFilters(true)}
            />
          )}
        </GlassCapsule>
      </TopBarActions>
      {job && searching && (
        <div className="pb-2.5">
          <PhoneMailSearch
            search={search}
            onChange={onChange}
            onClose={() => setSearching(false)}
          />
        </div>
      )}
      <MailFilterPills search={search} onChange={onChange} />
      <MailFiltersSheet
        search={search}
        onChange={onChange}
        open={allFilters}
        onOpenChange={setAllFilters}
      />
    </>
  );
}
