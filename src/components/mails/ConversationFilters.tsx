import { useState } from 'react';
import { Close, Filter } from '@carbon/icons-react';
import { Dialog } from '@base-ui/react/dialog';
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
import { Select } from '../ui/select';
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
  'flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover hover:text-text-primary data-popup-open:bg-layer-accent data-popup-open:text-text-primary';

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
          <Filter size={16} aria-hidden="true" />
          Filters
          <CountBadge count={filterCount(search)} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner align="end" sideOffset={6} className="z-40 outline-none">
            <Popover.Popup className="flex w-[300px] origin-[var(--transform-origin)] flex-col gap-4 rounded-lg border border-border-subtle bg-menu p-4 text-text-primary shadow-popup outline-none transition-[opacity,scale] duration-150 ease-entrance data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0">
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

const QUICK_CHIP =
  'flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border-default px-3 text-[13px] font-medium whitespace-nowrap text-text-primary transition-colors duration-70 ease-standard aria-pressed:border-transparent aria-pressed:bg-tint aria-pressed:text-tint-text';

/**
 * On phones, one row under the AI notice: Needs action and New only, one tap each; Filters opens a
 * sheet with every filter and the sort; `end` (the sync button) sits at the right.
 */
export function PhoneMailChips({
  search,
  onChange,
  end,
}: FiltersProps & { end?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const needs = search.request === 'open';
  const unseen = search.unseen === true;
  return (
    <div className="-mx-4 flex items-center gap-2 px-4">
      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto [scrollbar-width:none]">
        <button
          type="button"
          aria-pressed={needs}
          className={QUICK_CHIP}
          onClick={() => onChange({ request: needs ? undefined : 'open' })}
        >
          Needs action
        </button>
        <button
          type="button"
          aria-pressed={unseen}
          className={QUICK_CHIP}
          onClick={() => onChange({ unseen: unseen ? undefined : true })}
        >
          New only
        </button>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className={QUICK_CHIP}>
            <Filter size={16} aria-hidden="true" />
            Filters
            <CountBadge count={filterCount(search)} />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-240 ease-entrance data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <Dialog.Popup className="fixed right-0 bottom-0 left-0 z-50 flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-t-xl bg-surface p-4 pt-3 text-text-primary outline-none transition-transform duration-240 ease-entrance data-ending-style:translate-y-full data-ending-style:ease-exit data-starting-style:translate-y-full">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-lg font-semibold">Filters</Dialog.Title>
                <Dialog.Close
                  aria-label="Close filters"
                  className="flex size-11 cursor-pointer items-center justify-center"
                >
                  <Close size={20} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <FilterFields search={search} onChange={onChange} layout="sheet" />
              <SortSelect search={search} onChange={onChange} layout="sheet" />
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  className="cursor-pointer text-sm text-link hover:underline"
                  onClick={() => onChange(NO_FILTERS)}
                >
                  Clear filters
                </button>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      {end}
    </div>
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
