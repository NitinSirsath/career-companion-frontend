import { SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { Popover } from '@base-ui/react/popover';
import {
  ACTION_FILTERS,
  APPLICATION_FILTERS,
  CATEGORY_LABEL,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  type MailsSearch,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Sheet } from '../ui/sheet';
import { POPUP_MOTION, Select } from '../ui/select';
import { FilterChips, ToolbarSearch, type FilterChip } from '../ui/toolbar';
import { useSearchText } from '../useSearchText';

interface FilterSelectProps<T extends string> {
  id: string;
  label: string;
  layout: 'inline' | 'sheet';
  /** The first option: what the list shows when nothing is chosen. */
  emptyLabel?: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
}

function FilterSelect<T extends string>({
  id,
  label,
  layout,
  emptyLabel = 'All',
  value,
  options,
  onChange,
}: FilterSelectProps<T>) {
  return (
    <Select<string>
      id={id}
      label={label}
      appearance={layout === 'inline' ? 'inline' : 'field'}
      options={[{ value: '', label: emptyLabel }, ...options]}
      value={value ?? ''}
      onValueChange={(next) => onChange(options.find((option) => option.value === next)?.value)}
    />
  );
}

interface FiltersProps {
  search: MailsSearch;
  onChange: (changes: Partial<MailsSearch>) => void;
}

const labelOf = <T extends string>(options: readonly { value: T; label: string }[], value: T) =>
  options.find((option) => option.value === value)?.label ?? value;

/** The filters in use, as chips the user can remove one by one. */
function activeChips(
  search: MailsSearch,
  onChange: (changes: Partial<MailsSearch>) => void,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (search.q)
    chips.push({ label: `Search: ${search.q}`, onRemove: () => onChange({ q: undefined }) });
  if (search.request)
    chips.push({
      label: `Action: ${labelOf(ACTION_FILTERS, search.request)}`,
      onRemove: () => onChange({ request: undefined }),
    });
  if (search.category)
    chips.push({
      label: `Type: ${CATEGORY_LABEL[search.category]}`,
      onRemove: () => onChange({ category: undefined }),
    });
  if (search.application)
    chips.push({
      label: `Application: ${labelOf(APPLICATION_FILTERS, search.application)}`,
      onRemove: () => onChange({ application: undefined }),
    });
  if (search.unseen)
    chips.push({ label: 'New only', onRemove: () => onChange({ unseen: undefined }) });
  return chips;
}

/** How many filters are on, search not counted (it shows in its own box). */
const filterCount = (search: MailsSearch) =>
  [search.request, search.category, search.application, search.unseen].filter(Boolean).length;

/** Clears the search and every filter; the sort stays. */
const NO_FILTERS: Partial<MailsSearch> = {
  q: undefined,
  request: undefined,
  category: undefined,
  application: undefined,
  unseen: undefined,
};

/** Action, Type, Application and New only, as fields: in the Filters menu and the phone sheet. */
function FilterFields({ search, onChange, layout }: FiltersProps & { layout: string }) {
  return (
    <>
      <FilterSelect
        id={`mail-action-${layout}`}
        label="Action"
        layout="sheet"
        value={search.request}
        options={ACTION_FILTERS}
        onChange={(request) => onChange({ request })}
      />
      <FilterSelect
        id={`mail-type-${layout}`}
        label="Type"
        layout="sheet"
        value={search.category}
        options={TYPE_OPTIONS}
        onChange={(category) => onChange({ category })}
      />
      <FilterSelect
        id={`mail-application-${layout}`}
        label="Application"
        layout="sheet"
        value={search.application}
        options={APPLICATION_FILTERS}
        onChange={(application) => onChange({ application })}
      />
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-[var(--text-primary)]"
          checked={search.unseen === true}
          onChange={(event) => onChange({ unseen: event.target.checked || undefined })}
        />
        New only
      </label>
    </>
  );
}

function SortSelect({ search, onChange, layout }: FiltersProps & { layout: 'inline' | 'sheet' }) {
  return (
    <FilterSelect
      id={`mail-sort-${layout}`}
      label="Sort"
      layout={layout}
      emptyLabel="Newest first"
      value={search.sort === 'attention' ? 'attention' : undefined}
      options={SORT_OPTIONS}
      onChange={(sort) => onChange({ sort })}
    />
  );
}

const FILTERS_BUTTON =
  'flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 text-[13px] font-medium text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover hover:text-text-primary data-popup-open:bg-layer-accent data-popup-open:text-text-primary';

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="min-w-[18px] rounded-full bg-action-primary px-1.5 text-center text-[12px] leading-[18px] font-semibold text-text-inverse">
      {count}
    </span>
  );
}

/** The search box's id, for the phone top bar's search. */
export const MAIL_SEARCH_ID = 'mail-search';

/**
 * The Job mails tools on laptops, on the tabs' line (owner, 3 Nov 2026): the search, one Filters
 * menu (Action, Type, Application, New only) and the sort.
 */
export function MailTools({ search, onChange }: FiltersProps) {
  const [text, setText] = useSearchText(search.q ?? '', (q) => onChange({ q: q || undefined }));
  return (
    <div className="flex items-center gap-1 pb-1.5">
      <div className="mr-1 w-64">
        <ToolbarSearch
          id={MAIL_SEARCH_ID}
          label="Search"
          value={text}
          onChange={setText}
          placeholder="Search mails"
        />
      </div>
      <Popover.Root>
        <Popover.Trigger className={FILTERS_BUTTON}>
          <SlidersHorizontalIcon size={16} aria-hidden="true" />
          Filters
          <CountBadge count={filterCount(search)} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner align="end" sideOffset={6} className="z-40 outline-none">
            <Popover.Popup
              className={`flex w-[300px] flex-col gap-4 rounded-lg border border-border-subtle glass-menu p-4 text-text-primary shadow-popup outline-none ${POPUP_MOTION}`}
            >
              <Popover.Title className="sr-only">Filters</Popover.Title>
              <FilterFields search={search} onChange={onChange} layout="menu" />
              <div className="-mx-4 -mb-4 flex items-center justify-between border-t border-border-subtle py-2 pr-2 pl-4">
                <button
                  type="button"
                  className="cursor-pointer text-[13px] text-link hover:underline"
                  onClick={() => onChange(NO_FILTERS)}
                >
                  Clear filters
                </button>
                <Popover.Close className={FILTERS_BUTTON}>Done</Popover.Close>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <SortSelect search={search} onChange={onChange} layout="inline" />
    </div>
  );
}

/** The filters in use under the toolbar, each removable, and "Clear all". */
export function MailFilterChips({ search, onChange }: FiltersProps) {
  return (
    <FilterChips chips={activeChips(search, onChange)} onClearAll={() => onChange(NO_FILTERS)} />
  );
}

/** The filters in use under the phone's Mails title, as small pills that remove themselves. */
export function MailFilterPills({ search, onChange }: FiltersProps) {
  const chips = activeChips(search, onChange);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          aria-label={`Remove filter ${chip.label}`}
          onClick={chip.onRemove}
          className="flex h-[30px] max-w-full cursor-pointer items-center gap-1 rounded-full bg-layer-accent pr-2 pl-3 text-[15px] text-text-primary active:opacity-60"
        >
          <span className="truncate">{chip.label}</span>
          <XIcon size={14} aria-hidden="true" className="shrink-0 text-text-tertiary" />
        </button>
      ))}
    </div>
  );
}

/** Every filter and the sort, in a sheet: the phone's "All filters". */
export function MailFiltersSheet({
  search,
  onChange,
  open,
  onOpenChange,
}: FiltersProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Filters">
      <FilterFields search={search} onChange={onChange} layout="sheet" />
      <SortSelect search={search} onChange={onChange} layout="sheet" />
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          className="cursor-pointer text-[17px] text-link"
          onClick={() => onChange(NO_FILTERS)}
        >
          Clear filters
        </button>
        <Button variant="secondary" size="lg" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </div>
    </Sheet>
  );
}

/** The search on phones: a field in the top bar with Cancel, instead of a box in the page. */
export function PhoneMailSearch({
  search,
  onChange,
  onClose,
}: FiltersProps & { onClose: () => void }) {
  const [text, setText] = useSearchText(search.q ?? '', (q) => onChange({ q: q || undefined }));
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="min-w-0 flex-1">
        <ToolbarSearch
          id={MAIL_SEARCH_ID}
          label="Search mails"
          value={text}
          onChange={setText}
          placeholder="Search mails"
          autoFocus
        />
      </div>
      <button
        type="button"
        className={cn('h-9 shrink-0 cursor-pointer px-2 text-sm text-text-secondary')}
        onClick={() => {
          setText('');
          onChange({ q: undefined });
          onClose();
        }}
      >
        Cancel
      </button>
    </div>
  );
}
