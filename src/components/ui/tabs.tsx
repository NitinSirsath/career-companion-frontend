import * as React from 'react';
import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { cn } from '../../lib/utils';

export interface TabItem<V extends string> {
  value: V;
  label: string;
  /** A small count after the label. */
  count?: React.ReactNode;
}

interface TabsProps<V extends string> {
  label: string;
  items: readonly TabItem<V>[];
  value: V;
  onValueChange: (value: V) => void;
  children?: React.ReactNode;
  className?: string;
  /** On phones: tabs across the full width with a line under the chosen one, or a row of chips. */
  phoneLook?: 'underline' | 'chips';
}

const PHONE_LIST = {
  underline: 'max-md:flex max-md:w-full max-md:border-0 max-md:border-b',
  chips:
    'max-md:-mx-4 max-md:flex max-md:w-[calc(100%+2rem)] max-md:max-w-none max-md:gap-2 max-md:border-0 max-md:px-4 max-md:[scrollbar-width:none]',
} as const;

const PHONE_TAB = {
  underline:
    'max-md:h-12 max-md:flex-1 max-md:justify-center max-md:border-l-0 max-md:data-active:bg-transparent max-md:data-active:shadow-[inset_0_-3px_0_var(--border-interactive)]',
  chips:
    'max-md:h-9 max-md:border max-md:border-border-default max-md:first:border-l max-md:data-active:border-transparent',
} as const;

/**
 * Segmented tabs in a bordered group, each with its count: "Job mails (5)". The chosen one has a
 * light blue tint. On phones they become full-width tabs or a row of chips (`phoneLook`). Put
 * `TabPanel`s inside as children.
 */
export function Tabs<V extends string>({
  label,
  items,
  value,
  onValueChange,
  children,
  className,
  phoneLook = 'underline',
}: TabsProps<V>) {
  return (
    <BaseTabs.Root
      value={value}
      onValueChange={(next) => onValueChange(next as V)}
      className={className}
    >
      <BaseTabs.List
        aria-label={label}
        className={cn(
          'inline-flex max-w-full overflow-x-auto border border-border-subtle align-top',
          PHONE_LIST[phoneLook],
        )}
      >
        {items.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            className={cn(
              'flex h-9 shrink-0 cursor-pointer items-center border-l border-border-subtle px-3.5 text-[14px] leading-5 font-medium whitespace-nowrap text-text-secondary transition-colors duration-70 ease-standard outline-none first:border-l-0 not-data-active:hover:bg-layer-hover not-data-active:hover:text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus data-active:bg-tint data-active:text-tint-text',
              PHONE_TAB[phoneLook],
            )}
          >
            {item.label}
            {item.count !== undefined && <> ({item.count})</>}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      {children}
    </BaseTabs.Root>
  );
}

export function TabPanel({
  value,
  className,
  ...props
}: { value: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <BaseTabs.Panel
      value={value}
      className={cn('animate-fade-in outline-none', className)}
      {...props}
    />
  );
}
