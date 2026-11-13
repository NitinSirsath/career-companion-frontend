import type { UseQueryResult } from '@tanstack/react-query';
import type {
  ApplicationResponse,
  ListApplicationEventsResponse,
} from '../../contracts/application';
import { useIsPhone } from '../layout/useIsPhone';
import { ApplicationConversations } from '../mails/ApplicationConversations';
import { ApplicationFacts } from './ApplicationFacts';
import { ApplicationHistory } from './ApplicationHistory';
import { NextSteps } from './NextSteps';

/**
 * The application's steps, mails, facts and history. Phones: one grouped list, the facts before
 * the history (owner, 12 Nov 2026); else a main column with the facts beside it.
 */
export function ApplicationOverview({
  id,
  application,
  senders,
  eventsQuery,
  eventsOffset,
  onEventsOffset,
}: {
  id: string;
  application: ApplicationResponse | undefined;
  senders: ReadonlyMap<string, string>;
  eventsQuery: UseQueryResult<ListApplicationEventsResponse>;
  eventsOffset: number;
  onEventsOffset: (offset: number) => void;
}) {
  const phone = useIsPhone();
  const steps = (
    <NextSteps applicationId={id} archived={!!application?.archivedAt} senders={senders} />
  );
  const facts = application && (
    <ApplicationFacts application={application} events={eventsQuery.data?.items ?? []} />
  );
  const history = (
    <ApplicationHistory query={eventsQuery} offset={eventsOffset} onOffset={onEventsOffset} />
  );
  if (phone)
    return (
      <div className="flex flex-col gap-6">
        {steps}
        <ApplicationConversations applicationId={id} />
        {facts}
        {history}
      </div>
    );
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        {steps}
        <ApplicationConversations applicationId={id} />
        {history}
      </div>
      {facts}
    </div>
  );
}
