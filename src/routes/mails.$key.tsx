import { createFileRoute, Link } from '@tanstack/react-router';
import { Building2Icon } from 'lucide-react';
import { useConversation, useMarkSeenOnOpen } from '../api/conversations';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { LoadedMail } from '../components/mails/LoadedMail';
import { Breadcrumb } from '../components/layout/Breadcrumb';
import { SectionError } from '../components/ui/section-error';
import { SkeletonList } from '../components/ui/skeleton';
import { listSearch } from '../lib/listMemory';
import type { MailsSearch } from '../lib/mails';

export const Route = createFileRoute('/mails/$key')({
  errorComponent: RouteErrorPage,
  component: JobMailPage,
});

/** A job mail's details: the conversation as Gmail has it, beside what it means for the search. */
function JobMailPage() {
  const { key } = Route.useParams();
  const { data, error, isLoading, refetch } = useConversation(key);
  const conversation = data?.conversation;
  useMarkSeenOnOpen(conversation);

  // The company (read from the mail, or its application's), else the subject: the page always has a name.
  const company = conversation?.company ?? conversation?.application?.companyName ?? undefined;
  const breadcrumb = (
    <Breadcrumb
      current={company ?? (conversation && (conversation.subject || '(No subject)'))}
      currentIcon={company ? Building2Icon : undefined}
    >
      <Link to="/mails" search={listSearch<MailsSearch>('/mails')}>
        Mails
      </Link>
    </Breadcrumb>
  );

  return (
    <div className="space-y-6">
      {isLoading && (
        <>
          {breadcrumb}
          <SkeletonList rows={4} label="Loading this mail" />
        </>
      )}
      {error && (
        <>
          {breadcrumb}
          <SectionError title="Could not load this mail" onRetry={() => void refetch()} />
        </>
      )}
      {data && <LoadedMail detail={data} breadcrumb={breadcrumb} />}
    </div>
  );
}
