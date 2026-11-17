import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useSandboxMailbox } from '../api/appMode';
import { useGmailStatus } from '../api/gmail';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { ProcessedMails } from '../components/gmail/ProcessedMails';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { PageHeader } from '../components/layout/PageHeader';
import { SkeletonList } from '../components/ui/skeleton';
import { TooltipProvider } from '../components/ui/tooltip';

export const Route = createFileRoute('/gmail_/mails')({
  errorComponent: RouteErrorPage,
  component: EveryMailPage,
});

/**
 * Every job mail the app has read, with Retry and Change link (owner, 17 Nov 2026): opened from
 * the Gmail sync page, which shows a summary instead.
 */
function EveryMailPage() {
  const sandbox = useSandboxMailbox();
  const [offset, setOffset] = useState(0);
  // As on the Gmail sync page before 17 Nov 2026: the list comes after the connection, whose
  // answer also starts the list's own refreshes.
  const status = useGmailStatus();
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-4">
        <PageHeader
          className="mb-2"
          title="Every mail it read"
          description="Check here when a job mail seems missing from Mails. Other mails are not listed. For them, the app keeps only Gmail's id, the date and that they are not job mails, for 35 days."
          breadcrumb={
            <Breadcrumb current="Every mail it read">
              <Link to="/gmail">Gmail sync</Link>
            </Breadcrumb>
          }
        />
        {/* Why rows wait for the AI, as above the list before it had its own page. */}
        {status.data?.connected && <AIAccessNotice />}
        {status.isLoading ? (
          <SkeletonList label="Loading the mails the app has read" />
        ) : (
          <ProcessedMails devMode={sandbox} offset={offset} onOffset={setOffset} />
        )}
      </div>
    </TooltipProvider>
  );
}
