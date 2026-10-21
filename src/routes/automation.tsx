import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { AutomationSetup } from '../components/automation/AutomationSetup';
import { NotSubmittedJobs } from '../components/automation/NotSubmittedJobs';
import { SubmittedApplications } from '../components/automation/SubmittedApplications';
import { SubmissionReview } from '../components/automation/SubmissionReview';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { PageHeader } from '../components/layout/PageHeader';
import { TabPanel, Tabs } from '../components/ui/tabs';

export const Route = createFileRoute('/automation')({
  errorComponent: RouteErrorPage,
  // The open tab is in the address, so a link or a reload opens the same one.
  validateSearch: z.object({
    tab: z.enum(['not-submitted', 'setup']).optional().catch(undefined),
  }),
  component: AutomationPage,
});

const PAGE_TABS = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'not-submitted', label: 'Not submitted' },
  { value: 'setup', label: 'Setup' },
] as const;
type PageTab = (typeof PAGE_TABS)[number]['value'];

/**
 * The user's own job-application automation (ADR-0002): what it sent, the jobs it did not apply
 * to, and how to connect it with an integration token.
 */
function AutomationPage() {
  const tab: PageTab = Route.useSearch().tab ?? 'submitted';
  const navigate = Route.useNavigate();
  const setTab = (next: PageTab) =>
    void navigate({ search: next === 'submitted' ? {} : { tab: next }, replace: true });
  return (
    <div className="flex flex-col">
      <PageHeader
        title="Automation"
        description="Let your own job-application automation tell Career Companion about each application it sends. Career Companion never applies to jobs itself."
      />
      <Tabs<PageTab> label="Automation" items={PAGE_TABS} value={tab} onValueChange={setTab}>
        <TabPanel value="submitted" className="flex flex-col gap-8 pt-6">
          <SubmissionReview />
          <SubmittedApplications />
        </TabPanel>
        <TabPanel value="not-submitted" className="pt-6">
          <NotSubmittedJobs />
        </TabPanel>
        <TabPanel value="setup">
          <AutomationSetup />
        </TabPanel>
      </Tabs>
    </div>
  );
}
