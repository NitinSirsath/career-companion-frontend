import * as React from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { Checkmark, ChevronDown } from '@carbon/icons-react';
import { cn } from '../../lib/utils';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

interface SelectProps<V extends string> {
  label: string;
  /** "field": the label sits above a full box. "inline": a filter button, "Label: value". */
  appearance?: 'field' | 'inline';
  /** Keeps the label for screen readers only (field appearance). */
  hideLabel?: boolean;
  options: readonly SelectOption<V>[];
  value: V;
  onValueChange: (value: V) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  helperText?: string;
  /** Points at text that explains the choice. */
  describedBy?: string;
  /** For moving focus to the box, as when an editor opens. */
  triggerRef?: React.Ref<HTMLButtonElement>;
  className?: string;
}

/**
 * Shared popup look for every dropdown: the menu colour, a thin border, a soft shadow, and an open
 * that fades and grows out of the side next to its field (150ms); it closes in 110ms.
 */
export const POPUP_CLASS =
  'border border-border-subtle bg-menu py-1 text-text-primary shadow-popup outline-none origin-[var(--transform-origin)] transition-[opacity,scale] duration-150 ease-entrance data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-110 data-ending-style:ease-exit data-starting-style:scale-[0.96] data-starting-style:opacity-0';

export const ITEM_CLASS =
  'flex min-h-10 cursor-pointer items-center justify-between gap-4 px-4 py-2 text-[14px] leading-5 text-text-primary outline-none select-none transition-colors duration-70 ease-standard data-highlighted:bg-menu-hover data-disabled:cursor-not-allowed data-disabled:text-text-disabled';

/**
 * A short fixed list. Opens below its box with the app's own menu (not the computer's), works with
 * the keyboard, and marks the chosen item.
 */
export function Select<V extends string>({
  label,
  appearance = 'field',
  hideLabel = false,
  options,
  value,
  onValueChange,
  id,
  name,
  disabled,
  helperText,
  describedBy,
  triggerRef,
  className,
}: SelectProps<V>) {
  const inline = appearance === 'inline';
  return (
    <BaseSelect.Root
      items={options}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as V);
      }}
      name={name}
      id={id}
      disabled={disabled}
    >
      <div className={cn('flex flex-col', className)}>
        <BaseSelect.Label
          className={cn('mb-2 text-xs text-text-secondary', (inline || hideLabel) && 'sr-only')}
        >
          {label}
        </BaseSelect.Label>
        <BaseSelect.Trigger
          ref={triggerRef}
          aria-describedby={describedBy}
          className={cn(
            'group flex cursor-pointer items-center justify-between gap-2 text-left text-[14px] leading-5 text-text-primary transition-colors duration-70 ease-standard outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus data-disabled:cursor-not-allowed data-disabled:text-text-disabled',
            inline
              ? 'h-10 border border-border-default bg-field px-3 whitespace-nowrap hover:bg-layer-hover'
              : 'h-10 w-full border border-border-default bg-field px-3 hover:bg-layer-hover',
          )}
        >
          <span className="min-w-0 truncate">
            {inline && (
              <span className="text-text-secondary" aria-hidden="true">
                {label}:{' '}
              </span>
            )}
            <BaseSelect.Value />
          </span>
          <BaseSelect.Icon className="flex transition-transform duration-110 ease-standard group-data-popup-open:rotate-180">
            <ChevronDown size={16} aria-hidden="true" />
          </BaseSelect.Icon>
        </BaseSelect.Trigger>
        {helperText && <p className="mt-2 text-xs text-text-secondary">{helperText}</p>}
      </div>
      <BaseSelect.Portal>
        <BaseSelect.Positioner
          alignItemWithTrigger={false}
          align="start"
          className="z-50 outline-none"
        >
          <BaseSelect.Popup className={cn(POPUP_CLASS, 'min-w-[var(--anchor-width)]')}>
            <BaseSelect.List className="max-h-[min(var(--available-height),20rem)] overflow-y-auto">
              {options.map((option) => (
                <BaseSelect.Item
                  key={option.value}
                  value={option.value}
                  className={cn(ITEM_CLASS, 'data-selected:font-semibold')}
                >
                  <BaseSelect.ItemText>{option.label}</BaseSelect.ItemText>
                  <BaseSelect.ItemIndicator className="flex text-link">
                    <Checkmark size={16} aria-hidden="true" />
                  </BaseSelect.ItemIndicator>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
