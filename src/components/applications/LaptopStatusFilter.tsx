import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import { STATUS_TABS, type StatusTab } from '../../lib/applicationsView';

/** Short words so the control fits beside the search (laptop v2, 18 Nov 2026). */
const SHORT: Partial<Record<StatusTab, string>> = { RECRUITER_CONTACT: 'Recruiter' };

/**
 * The status filter on laptops (laptop v2, owner 18 Nov 2026, `PHONE-LINEAR-mock/desktop.html`): one
 * small segmented control in the toolbar, the chosen status raised on a white thumb.
 */
export function LaptopStatusFilter({
  value,
  onValueChange,
}: {
  value: StatusTab;
  onValueChange: (value: StatusTab) => void;
}) {
  return (
    <BaseTabs.Root value={value} onValueChange={(next) => onValueChange(next as StatusTab)}>
      <BaseTabs.List
        aria-label="Status"
        className="inline-flex h-full max-w-full items-center overflow-x-auto rounded-lg bg-layer-hover p-0.5 [scrollbar-width:none]"
      >
        {STATUS_TABS.map((item) => (
          <BaseTabs.Tab
            key={item.value}
            value={item.value}
            aria-label={item.label}
            className="flex h-full shrink-0 cursor-pointer items-center rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap text-text-secondary transition-[color,background-color,box-shadow] duration-150 ease-standard outline-none hover:text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus data-active:bg-[var(--glass-on)] data-active:text-text-primary data-active:shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
          >
            {SHORT[item.value] ?? item.label}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
    </BaseTabs.Root>
  );
}
