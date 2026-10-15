import {
  ACTION_FILTERS,
  APPLICATION_FILTERS,
  SORT_OPTIONS,
  TYPE_OPTIONS,
  type MailsSearch,
} from '../../lib/mails';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';
import { useSearchText } from '../useSearchText';

interface FilterSelectProps<T extends string> {
  id: string;
  label: string;
  /** The first option: what the list shows when nothing is chosen. */
  emptyLabel?: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
}

function FilterSelect<T extends string>({
  id,
  label,
  emptyLabel = 'All',
  value,
  options,
  onChange,
}: FilterSelectProps<T>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value ?? ''}
        onChange={(event) =>
          onChange(options.find((option) => option.value === event.target.value)?.value)
        }
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

interface ConversationFiltersProps {
  search: MailsSearch;
  onChange: (changes: Partial<MailsSearch>) => void;
}

/** Search, the core filters and the sort order of the Job mails list. */
export function ConversationFilters({ search, onChange }: ConversationFiltersProps) {
  const [text, setText] = useSearchText(search.q ?? '', (q) => onChange({ q: q || undefined }));
  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 items-end">
      <div className="col-span-2 space-y-2">
        <Label htmlFor="mail-search">Search</Label>
        <Input
          id="mail-search"
          type="search"
          maxLength={100}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Company, role, sender or subject"
        />
      </div>
      <FilterSelect
        id="mail-action"
        label="Action"
        value={search.request}
        options={ACTION_FILTERS}
        onChange={(request) => onChange({ request })}
      />
      <FilterSelect
        id="mail-type"
        label="Type"
        value={search.category}
        options={TYPE_OPTIONS}
        onChange={(category) => onChange({ category })}
      />
      <FilterSelect
        id="mail-application"
        label="Application"
        value={search.application}
        options={APPLICATION_FILTERS}
        onChange={(application) => onChange({ application })}
      />
      <FilterSelect
        id="mail-sort"
        label="Sort"
        emptyLabel="Needs action first"
        value={search.sort === 'newest' ? 'newest' : undefined}
        options={SORT_OPTIONS}
        onChange={(sort) => onChange({ sort })}
      />
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={search.unseen === true}
          onChange={(event) => onChange({ unseen: event.target.checked || undefined })}
        />
        New only
      </label>
    </div>
  );
}
