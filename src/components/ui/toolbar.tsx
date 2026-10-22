import * as React from 'react';
import { Close, Filter, Search } from '@carbon/icons-react';
import { Dialog } from '@base-ui/react/dialog';
import { cn } from '../../lib/utils';
import { Button } from './button';

/** The bar above a table: search on the left, then filters. On phones the filters open in a sheet. */
export function Toolbar({
  search,
  filters,
  end,
  filterCount = 0,
}: {
  search: React.ReactNode;
  /** The filter dropdowns, drawn inline on laptops and in a sheet on phones. */
  filters?: (layout: 'inline' | 'sheet') => React.ReactNode;
  /** Shown at the right end on laptops: the sort. */
  end?: (layout: 'inline' | 'sheet') => React.ReactNode;
  filterCount?: number;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="flex items-stretch border-b border-border-subtle bg-surface">
      <div className="min-w-0 flex-1">{search}</div>
      {filters && (
        <div className="hidden items-stretch md:flex [&>*]:border-l [&>*]:border-border-subtle">
          {filters('inline')}
          {end?.('inline')}
        </div>
      )}
      {filters && (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="flex h-12 shrink-0 cursor-pointer items-center gap-2 border-l border-border-subtle px-4 text-sm md:hidden">
            <Filter size={16} aria-hidden="true" />
            Filters
            {filterCount > 0 && (
              <span className="bg-tag-blue-bg px-1.5 text-xs text-tag-blue">{filterCount}</span>
            )}
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-240 ease-entrance data-ending-style:opacity-0 data-starting-style:opacity-0" />
            <Dialog.Popup className="fixed right-0 bottom-0 left-0 z-50 max-h-[85vh] overflow-y-auto bg-surface p-4 pt-3 text-text-primary outline-none transition-transform duration-240 ease-entrance data-ending-style:translate-y-full data-ending-style:ease-exit data-starting-style:translate-y-full">
              <div className="mb-4 flex items-center justify-between">
                <Dialog.Title className="text-lg">Filters</Dialog.Title>
                <Dialog.Close
                  aria-label="Close filters"
                  className="flex size-11 cursor-pointer items-center justify-center"
                >
                  <Close size={20} aria-hidden="true" />
                </Dialog.Close>
              </div>
              <div className="flex flex-col gap-5">
                {filters('sheet')}
                {end?.('sheet')}
              </div>
              <Button className="mt-6 w-full justify-start" onClick={() => setOpen(false)}>
                Show results
              </Button>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}

/** The search box of a toolbar: a magnifier, the field, and its hidden label. */
export function ToolbarSearch({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 100,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  maxLength?: number;
}) {
  const id = React.useId();
  return (
    <div className="flex h-12 items-center gap-3 px-4 text-text-secondary focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-border-focus">
      <Search size={16} aria-hidden="true" className="shrink-0" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
      />
    </div>
  );
}

export interface FilterChip {
  label: string;
  onRemove: () => void;
}

/** The filters in use, each removable, and "Clear all". Hidden when no filter is on. */
export function FilterChips({
  chips,
  onClearAll,
  summary,
}: {
  chips: readonly FilterChip[];
  onClearAll: () => void;
  summary?: React.ReactNode;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-surface px-4 py-3">
      {summary && <span className="text-xs text-text-secondary">{summary}</span>}
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex h-6 animate-open items-center bg-tag-gray-bg pl-2 text-xs text-tag-gray"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remove filter: ${chip.label}`}
            onClick={chip.onRemove}
            className={cn(
              'flex size-6 cursor-pointer items-center justify-center transition-colors duration-70 ease-standard hover:bg-layer-hover',
            )}
          >
            <Close size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="sm" className="h-6" onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  );
}
