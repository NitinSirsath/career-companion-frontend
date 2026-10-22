import {
  ACTION_FILTERS,
  APPLICATION_FILTERS,
  CATEGORY_LABEL,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  type MailsSearch,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
import { useIsPhone } from '../layout/useIsPhone';
import { Select } from '../ui/select';
import { FilterChips, Toolbar, ToolbarSearch, type FilterChip } from '../ui/toolbar';
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

interface ConversationFiltersProps {
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

/** "New only": a bordered box like the filter buttons in the toolbar, a plain checkbox in the sheet. */
function NewOnly({
  layout,
  checked,
  onChange,
}: {
  layout: 'inline' | 'sheet';
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex h-10 cursor-pointer items-center gap-2 text-sm whitespace-nowrap',
        layout === 'inline' &&
          'border border-border-default bg-field px-3 transition-colors duration-70 ease-standard hover:bg-layer-hover',
      )}
    >
      <input
        type="checkbox"
        className="size-4 accent-[var(--text-primary)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      New only
    </label>
  );
}

/** The search box's id, for the phone top bar's search button. */
export const MAIL_SEARCH_ID = 'mail-search';

const QUICK_CHIP =
  'flex h-9 shrink-0 cursor-pointer items-center border border-border-default px-3 text-sm whitespace-nowrap text-text-primary transition-colors duration-70 ease-standard aria-pressed:border-transparent aria-pressed:bg-tint aria-pressed:text-tint-text';

/** On phones: the two filters used most, one tap each, under the search box. */
function QuickFilters({ search, onChange }: ConversationFiltersProps) {
  const needs = search.request === 'open';
  const unseen = search.unseen === true;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
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
    </div>
  );
}

/** Clears the search and every filter; the sort stays. */
const NO_FILTERS: Partial<MailsSearch> = {
  q: undefined,
  request: undefined,
  category: undefined,
  application: undefined,
  unseen: undefined,
};

/** The Job mails toolbar: search, the filters, "New only" and the sort; then the active filters. */
export function ConversationFilters({ search, onChange }: ConversationFiltersProps) {
  const phone = useIsPhone();
  const [text, setText] = useSearchText(search.q ?? '', (q) => onChange({ q: q || undefined }));
  const chips = activeChips(search, onChange);
  const filters = (layout: 'inline' | 'sheet') => (
    <>
      <FilterSelect
        id={`mail-action-${layout}`}
        label="Action"
        layout={layout}
        value={search.request}
        options={ACTION_FILTERS}
        onChange={(request) => onChange({ request })}
      />
      <FilterSelect
        id={`mail-type-${layout}`}
        label="Type"
        layout={layout}
        value={search.category}
        options={TYPE_OPTIONS}
        onChange={(category) => onChange({ category })}
      />
      <FilterSelect
        id={`mail-application-${layout}`}
        label="Application"
        layout={layout}
        value={search.application}
        options={APPLICATION_FILTERS}
        onChange={(application) => onChange({ application })}
      />
      <NewOnly
        layout={layout}
        checked={search.unseen === true}
        onChange={(unseen) => onChange({ unseen: unseen || undefined })}
      />
    </>
  );
  return (
    <div>
      <Toolbar
        filterCount={chips.length}
        search={
          <ToolbarSearch
            id={MAIL_SEARCH_ID}
            label="Search"
            value={text}
            onChange={setText}
            placeholder="Search company, role, sender or subject"
          />
        }
        filters={filters}
        end={(layout) => (
          <FilterSelect
            id={`mail-sort-${layout}`}
            label="Sort"
            layout={layout}
            emptyLabel="Needs action first"
            value={search.sort === 'newest' ? 'newest' : undefined}
            options={SORT_OPTIONS}
            onChange={(sort) => onChange({ sort })}
          />
        )}
      />
      {phone ? (
        <QuickFilters search={search} onChange={onChange} />
      ) : (
        <FilterChips chips={chips} onClearAll={() => onChange(NO_FILTERS)} />
      )}
    </div>
  );
}
