import { useCallback, useState, type ReactNode } from 'react';
import { Menu } from '@base-ui/react/menu';
import { CheckIcon, EllipsisIcon, RefreshCwIcon, SlidersHorizontalIcon } from 'lucide-react';
import {
  ARCHIVE_OPTIONS,
  SORT_OPTIONS,
  STATUS_TABS,
  type DiscoveryView,
} from '../../lib/applicationsView';
import { cn } from '../../lib/utils';
import { TopBarActions } from '../layout/Breadcrumb';
import { CapsuleButton, GlassCapsule } from '../phone/GlassButton';
import { PhoneTitle } from '../phone/PhoneTitle';
import { useTabBarSearch } from '../phone/phoneNav';
import { Collapse } from '../ui/collapse';
import { ITEM_CLASS, POPUP_CLASS } from '../ui/select';
import { useRefresh } from '../ui/useRefresh';

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

/** The capsule's ··· menu: fetch the list again. Search is the tab bar's Search circle. */
function MoreMenu() {
  const { refresh } = useRefresh();
  return (
    <Menu.Root>
      <Menu.Trigger render={<CapsuleButton label="More" />}>
        <EllipsisIcon size={22} aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} className="z-50 outline-none">
          <Menu.Popup className={cn(POPUP_CLASS, 'phone-type min-w-56 rounded-[18px]')}>
            <Menu.Item className={ROW} onClick={() => void refresh()}>
              <RefreshCwIcon size={18} aria-hidden="true" />
              Refresh
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/**
 * The top of Applications on phones (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 5): the
 * big title beside one glass capsule with the filters and ··· (refresh); then the filters in use.
 * The tab bar's Search circle opens the search row under the title. `search`: the page's own search box.
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
  // The tab bar's Search circle opens this list's search (owner, 18 Nov 2026).
  useTabBarSearch(useCallback(() => setSearching(true), []));
  return (
    <div className="flex flex-col px-1 pt-0.5">
      <TopBarActions>
        <GlassCapsule label="Application tools">
          <FilterMenu view={view} onChange={onChange} />
          <MoreMenu />
        </GlassCapsule>
      </TopBarActions>
      <PhoneTitle>Applications</PhoneTitle>
      {chips}
      {/* The search slides open under the title and closes the same way (15 Nov 2026). */}
      <Collapse open={searching}>
        <div className="pt-3">{search(() => setSearching(false))}</div>
      </Collapse>
    </div>
  );
}
