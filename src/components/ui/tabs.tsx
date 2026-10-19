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

/** Line tabs: the underline slides to the chosen tab. Put `TabPanel`s inside as children. */
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
        className="relative flex overflow-x-auto border-b border-border-subtle"
      >
        {items.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            className="flex h-12 shrink-0 cursor-pointer items-center gap-2 px-4 text-sm whitespace-nowrap text-text-secondary transition-colors duration-70 ease-standard outline-none hover:bg-layer-hover hover:text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus data-active:font-semibold data-active:text-text-primary"
          >
            {item.label}
            {item.count !== undefined && (
              <span className="inline-flex h-5 min-w-6 items-center justify-center bg-surface-selected px-1.5 text-xs font-normal text-text-primary">
                {item.count}
              </span>
            )}
          </BaseTabs.Tab>
        ))}
        <BaseTabs.Indicator className="absolute bottom-0 left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) bg-border-interactive transition-[translate,width] duration-150 ease-standard" />
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
