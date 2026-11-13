import { useMemo, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Building2Icon } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ApplicationHeader } from '../components/applications/ApplicationHeader';
import { ApplicationOverview } from '../components/applications/ApplicationOverview';
import { ApplicationTabs } from '../components/applications/ApplicationTabs';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { Button } from '../components/ui/button';
import { InlineNotification } from '../components/ui/notification';
import { SectionError } from '../components/ui/section-error';
import { SkeletonList } from '../components/ui/skeleton';
import { mailSenders } from '../lib/applicationDetail';
import { applicationQueryOptions } from '../lib/applicationCache';
import type { ApplicationsSearch } from '../lib/applicationsView';
import { listSearch } from '../lib/listMemory';

export const Route = createFileRoute('/applications/$id')({
  errorComponent: RouteErrorPage,
  component: ApplicationDetailPage,
});

function ApplicationDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [eventsOffset, setEventsOffset] = useState(0);
  const applicationQuery = useQuery(applicationQueryOptions(queryClient, id));
  const eventsQuery = useQuery({
    queryKey: ['application-events', id, eventsOffset],
    queryFn: ({ signal }) => api.getApplicationEvents(id, { offset: eventsOffset }, { signal }),
  });
  const application = applicationQuery.data;
  const events = eventsQuery.data?.items;
  const senders = useMemo(() => mailSenders(events ?? []), [events]);
  // Editing needs a currently valid application read; a stale cached copy is shown but not editable.
  const canEdit = !!application && !applicationQuery.isError;

  const breadcrumb = (
    <Breadcrumb current={application?.companyName} currentIcon={Building2Icon}>
      <Link to="/applications" search={listSearch<ApplicationsSearch>('/applications')}>
        Applications
      </Link>
    </Breadcrumb>
  );

  const overview = (
    <ApplicationOverview
      id={id}
      application={application}
      senders={senders}
      eventsQuery={eventsQuery}
      eventsOffset={eventsOffset}
      onEventsOffset={setEventsOffset}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      {application ? (
        <ApplicationHeader
          key={application.id}
          application={application}
          canEdit={canEdit}
          breadcrumb={breadcrumb}
        />
      ) : (
        breadcrumb
      )}
      {applicationQuery.isLoading && <SkeletonList rows={2} label="Loading this application" />}
      {applicationQuery.isError &&
        (application ? (
          <InlineNotification
            kind="warning"
            title="This may be out of date."
            action={
              <Button
                variant="ghost"
                size="sm"
                className="-my-1.5"
                onClick={() => void applicationQuery.refetch()}
              >
                Try again
              </Button>
            }
          >
            The latest version did not load, so you see an earlier one. Changes are off until it
            loads.
          </InlineNotification>
        ) : (
          <SectionError
            title="Could not load this application"
            onRetry={() => void applicationQuery.refetch()}
          />
        ))}
      {application?.submittedVia === 'AUTOMATION' ? (
        <ApplicationTabs applicationId={id} overview={overview} />
      ) : (
        overview
      )}
    </div>
  );
}
