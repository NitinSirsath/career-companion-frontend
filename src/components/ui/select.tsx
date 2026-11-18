import * as React from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
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
 * Shared popup look for every dropdown, ··· menu and pop-over, phone and laptop (owner, 18 Nov
 * 2026, mocks `PHONE-LINEAR-mock/`): the phone's glass, 14px corners. It grows out of the corner
 * of its button and blurs in (~220ms, a little spring), and shrinks back into it faster.
 * Reduce Motion: a fade.
 */
export const POPUP_MOTION =
  'motion-fade origin-[var(--transform-origin)] transition-[opacity,scale,filter] duration-220 ease-spring data-ending-style:scale-75 data-ending-style:opacity-0 data-ending-style:blur-[4px] data-ending-style:duration-160 data-ending-style:ease-exit data-starting-style:scale-50 data-starting-style:opacity-0 data-starting-style:blur-[6px]';

export const POPUP_CLASS = `rounded-[14px] glass-menu p-[5px] text-text-primary outline-none ${POPUP_MOTION}`;

/** A menu row: the highlight is a soft pill that follows the pointer, or the finger on phones. */
export const ITEM_CLASS =
  'flex min-h-8 cursor-pointer items-center justify-between gap-4 rounded-[8px] px-[9px] py-1.5 text-[14px] leading-5 text-text-primary outline-none select-none transition-colors duration-70 ease-standard data-highlighted:bg-[var(--glass-pill)] data-disabled:cursor-not-allowed data-disabled:text-text-disabled';

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
              ? 'h-9 rounded-full border border-border-default bg-field px-3.5 whitespace-nowrap hover:bg-layer-hover'
              : 'h-9 w-full rounded-full border border-border-default bg-field px-3.5 hover:bg-layer-hover',
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
            <ChevronDownIcon size={16} aria-hidden="true" />
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
                    <CheckIcon size={16} aria-hidden="true" />
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
