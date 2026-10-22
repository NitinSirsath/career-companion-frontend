import * as React from 'react';
import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { Checkmark, ChevronDown } from '@carbon/icons-react';
import { cn } from '../../lib/utils';
import { AutoHeight } from './auto-height';
import { ITEM_CLASS, POPUP_CLASS } from './select';
import { Spinner } from './spinner';

interface ComboboxProps<T> {
  label: string;
  hideLabel?: boolean;
  items: readonly T[];
  value: T | null;
  onValueChange: (value: T | null) => void;
  /** The text shown in the box for an item, and searched when the list filters itself. */
  itemToString: (item: T) => string;
  itemKey: (item: T) => string;
  /** How an item looks in the list; the text from `itemToString` when left out. */
  renderItem?: (item: T) => React.ReactNode;
  /**
   * For lists the server searches: called as the user types, and the parent loads `items`.
   * Without it, the list filters its own items.
   */
  onSearch?: (text: string) => void;
  /** The server is loading items: shows a "Searching…" row. */
  loading?: boolean;
  emptyText?: string;
  placeholder?: string;
  helperText?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Type to search a long list, or one the server loads page by page. Shows "Searching…" while it
 * loads and says so when nothing matches.
 */
export function Combobox<T>({
  label,
  hideLabel = false,
  items,
  value,
  onValueChange,
  itemToString,
  itemKey,
  renderItem,
  onSearch,
  loading = false,
  emptyText = 'Nothing matches',
  placeholder,
  helperText,
  id,
  disabled,
  className,
}: ComboboxProps<T>) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  return (
    <BaseCombobox.Root
      items={items as T[]}
      value={value}
      onValueChange={(next) => onValueChange((next as T | null) ?? null)}
      itemToStringLabel={itemToString}
      isItemEqualToValue={(item, current) => itemKey(item as T) === itemKey(current as T)}
      filter={onSearch ? null : undefined}
      onInputValueChange={(text, { reason }) => {
        if (onSearch && reason !== 'item-press') onSearch(text);
      }}
      disabled={disabled}
    >
      <div className={cn('flex flex-col', className)}>
        <label
          htmlFor={inputId}
          className={cn('mb-2 text-xs text-text-secondary', hideLabel && 'sr-only')}
        >
          {label}
        </label>
        <BaseCombobox.InputGroup className="relative flex h-10 items-center border border-border-default bg-field focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-border-focus">
          {/* Named twice on purpose: while the list is open the page around it, label included, is
              hidden from screen readers, and the box must keep its name. */}
          <BaseCombobox.Input
            id={inputId}
            aria-label={label}
            placeholder={placeholder}
            className="h-full w-full min-w-0 bg-transparent pr-10 pl-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary disabled:text-text-disabled"
          />
          <BaseCombobox.Trigger
            aria-label={`Open ${label}`}
            className="group absolute right-0 flex h-full w-10 cursor-pointer items-center justify-center text-text-primary"
          >
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="transition-transform duration-110 ease-standard group-data-popup-open:rotate-180"
            />
          </BaseCombobox.Trigger>
        </BaseCombobox.InputGroup>
        {helperText && <p className="mt-2 text-xs text-text-secondary">{helperText}</p>}
      </div>
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner align="start" className="z-50 outline-none">
          <BaseCombobox.Popup
            aria-busy={loading || undefined}
            className={cn(POPUP_CLASS, 'w-[var(--anchor-width)] max-w-[var(--available-width)]')}
          >
            {/* The list's height follows the results as the user types, instead of jumping. */}
            <AutoHeight contentClassName="max-h-[min(var(--available-height),20rem)] overflow-y-auto overscroll-contain">
              <BaseCombobox.Status>
                {loading && (
                  <div className="flex min-h-10 items-center gap-2 px-4 text-sm text-text-secondary">
                    <Spinner />
                    Searching…
                  </div>
                )}
              </BaseCombobox.Status>
              {!loading && (
                <BaseCombobox.Empty>
                  <div className="flex min-h-10 items-center px-4 text-sm text-text-secondary">
                    {emptyText}
                  </div>
                </BaseCombobox.Empty>
              )}
              <BaseCombobox.List>
                {(item: T) => (
                  <BaseCombobox.Item key={itemKey(item)} value={item} className={ITEM_CLASS}>
                    <span className="min-w-0">
                      {renderItem ? renderItem(item) : itemToString(item)}
                    </span>
                    <BaseCombobox.ItemIndicator className="flex text-link">
                      <Checkmark size={16} aria-hidden="true" />
                    </BaseCombobox.ItemIndicator>
                  </BaseCombobox.Item>
                )}
              </BaseCombobox.List>
            </AutoHeight>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
