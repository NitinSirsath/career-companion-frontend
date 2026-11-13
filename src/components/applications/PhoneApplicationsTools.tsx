import { useState, type ReactNode } from 'react';
import { Menu } from '@base-ui/react/menu';
import { CheckIcon, SearchIcon, SlidersHorizontalIcon } from 'lucide-react';
import {
  ARCHIVE_OPTIONS,
  SORT_OPTIONS,
  STATUS_TABS,
  type DiscoveryView,
} from '../../lib/applicationsView';
import { cn } from '../../lib/utils';
import { TopBarActions } from '../layout/Breadcrumb';
import { CapsuleButton, GlassCapsule } from '../phone/GlassButton';
import { PhoneRefresh } from '../phone/PhoneRefresh';
import { PhoneTitle } from '../phone/PhoneTitle';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';

const ROW = cn(ITEM_CLASS, 'min-h-11 justify-start gap-3 text-[17px]');

/** One group of choices in the filter menu, with a tick at the chosen one. */
function Choices<V extends string>({
  options,
  value,
  onPick,
}: {
  options: readonly { value: V; label: string }[];
  value: V;
  onPick: (value: V) => void;
}) {
  return (
    <Menu.RadioGroup value={value} onValueChange={(next) => onPick(next as V)}>
      {options.map((option) => (
        <Menu.RadioItem key={option.value} value={option.value} className={ROW}>
          <span className="flex w-[18px]">
            <Menu.RadioItemIndicator>
              <CheckIcon size={18} aria-hidden="true" />
            </Menu.RadioItemIndicator>
          </span>
          {option.label}
        </Menu.RadioItem>
      ))}
    </Menu.RadioGroup>
  );
}

/** The capsule's filter menu: the status (In progress), which applications show, and the order. */
function FilterMenu({
  view,
  onChange,
}: {
  view: DiscoveryView;
  onChange: (changes: Partial<DiscoveryView>) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger render={<CapsuleButton label="Filter and sort" />}>
        <SlidersHorizontalIcon size={22} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} className="z-50 outline-none">
          <Menu.Popup
            className={cn(
              POPUP_CLASS,
              'phone-type max-h-[var(--available-height)] min-w-60 overflow-y-auto rounded-[18px]',
            )}
          >
            {view.list === 'progress' && (
              <>
                <Choices
                  options={STATUS_TABS}
                  value={view.tab}
                  onPick={(tab) => onChange({ tab })}
                />
                <Menu.Separator className="my-1 h-px bg-border-subtle" />
              </>
            )}
            <Choices
              options={ARCHIVE_OPTIONS}
              value={view.archive}
              onPick={(archive) => onChange({ archive })}
            />
            <Menu.Separator className="my-1 h-px bg-border-subtle" />
            <Choices
              options={SORT_OPTIONS}
              value={view.sort}
              onPick={(sort) => onChange({ sort })}
            />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/**
 * The top of Applications on phones (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): the big
 * title, then the filters in use; refresh, search and filters sit in the glass capsule at the top
 * right. The search row opens under the title. `search`: the page's own search box.
 */
export function PhoneApplicationsTools({
  view,
  onChange,
  chips,
  search,
}: {
  view: DiscoveryView;
  onChange: (changes: Partial<DiscoveryView>) => void;
  /** The filters in use, as removable chips. */
  chips: ReactNode;
  search: (onClose: () => void) => ReactNode;
}) {
  const [searching, setSearching] = useState(!!view.search);
  return (
    <div className="flex flex-col px-1 pt-0.5">
      <TopBarActions>
        <GlassCapsule label="Application tools">
          <PhoneRefresh />
          <CapsuleButton label="Search applications" onClick={() => setSearching(true)}>
            <SearchIcon size={22} aria-hidden="true" />
          </CapsuleButton>
          <FilterMenu view={view} onChange={onChange} />
        </GlassCapsule>
      </TopBarActions>
      <PhoneTitle>Applications</PhoneTitle>
      {chips}
      {searching && <div className="pt-3">{search(() => setSearching(false))}</div>}
    </div>
  );
}
