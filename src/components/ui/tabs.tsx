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
}

/**
 * Segmented tabs in a bordered group, each with its count: "Job mails (5)". The chosen one has a
 * light blue tint. Put `TabPanel`s inside as children.
 */
export function Tabs<V extends string>({
  label,
  items,
  value,
  onValueChange,
  children,
  className,
}: TabsProps<V>) {
  return (
    <BaseTabs.Root
      value={value}
      onValueChange={(next) => onValueChange(next as V)}
      className={className}
    >
      <BaseTabs.List
        aria-label={label}
        className="inline-flex max-w-full overflow-x-auto border border-border-subtle align-top"
      >
        {items.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            className="flex h-9 shrink-0 cursor-pointer items-center border-l border-border-subtle px-3.5 text-sm whitespace-nowrap text-text-secondary transition-colors duration-70 ease-standard outline-none first:border-l-0 not-data-active:hover:bg-layer-hover not-data-active:hover:text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus data-active:bg-tint data-active:text-tint-text"
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
