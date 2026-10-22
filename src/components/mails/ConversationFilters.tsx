import {
  ACTION_FILTERS,
  APPLICATION_FILTERS,
  CATEGORY_LABEL,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  type MailsSearch,
} from '../../lib/mails';
import { cn } from '../../lib/utils';
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

/** The Job mails toolbar: search, the filters, "New only" and the sort; then the active filters. */
export function ConversationFilters({ search, onChange }: ConversationFiltersProps) {
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
      <FilterChips
        chips={chips}
        onClearAll={() =>
          onChange({
            q: undefined,
            request: undefined,
            category: undefined,
            application: undefined,
            unseen: undefined,
          })
        }
      />
    </div>
  );
}
