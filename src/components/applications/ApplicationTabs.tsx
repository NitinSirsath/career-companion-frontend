import { useState, type ReactNode } from 'react';
import { TabPanel, Tabs } from '../ui/tabs';
import { AutomationDetails } from './AutomationDetails';

const PAGE_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'automation', label: 'Automation details' },
] as const;
type PageTab = (typeof PAGE_TABS)[number]['value'];

/** An automation application's page: everything as usual, and what the automation reported. */
export function ApplicationTabs({
  applicationId,
  overview,
}: {
  applicationId: string;
  overview: ReactNode;
}) {
  const [tab, setTab] = useState<PageTab>('overview');
  return (
    <Tabs<PageTab> label="Application" items={PAGE_TABS} value={tab} onValueChange={setTab}>
      <TabPanel value="overview" className="pt-6">
        {overview}
      </TabPanel>
      <TabPanel value="automation" className="pt-6">
        <AutomationDetails applicationId={applicationId} />
      </TabPanel>
    </Tabs>
  );
}
