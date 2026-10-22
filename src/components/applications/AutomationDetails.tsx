import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ApplicationSubmission } from '../../contracts/submission';
import { dateAndTime } from '../../lib/applicationDetail';
import { platformLabel } from '../../lib/eventLabels';
import { safeHttpUrl } from '../../lib/safeUrl';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';

const WORK_MODE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site' };

const notSent = <span className="text-text-tertiary">Not sent</span>;

/** A platform keeps its name; "we_work_remotely" reads as "We work remotely". */
const words = (value: string) => {
  const label = platformLabel(value);
  if (label !== value) return label;
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** The URL itself as the link text, so the user sees where it goes. Plain text when not http(s). */
function UrlValue({ value }: { value: string | null }) {
  if (!value) return notSent;
  const href = safeHttpUrl(value);
  if (!href) return <span className="break-all">{value}</span>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-link">
      {value}
    </a>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col gap-3 border border-border-subtle bg-surface px-6 py-5"
    >
      <h3 className="text-xs text-text-secondary">{title}</h3>
      {children}
    </section>
  );
}

/** Every field comes from the user's automation and is untrusted: rendered as plain text only. */
function SubmissionDetails({ submission }: { submission: ApplicationSubmission }) {
  const facts: { label: string; value: ReactNode }[] = [
    { label: 'Job post', value: <UrlValue value={submission.jobUrl} /> },
    { label: 'Apply page', value: <UrlValue value={submission.applyUrl} /> },
    { label: 'Platform', value: platformLabel(submission.platform) },
    {
      label: 'Found on',
      value: submission.discoverySource ? words(submission.discoverySource) : notSent,
    },
    { label: 'Location', value: submission.location ?? notSent },
    {
      label: 'Work mode',
      value: submission.workMode
        ? (WORK_MODE[submission.workMode] ?? submission.workMode)
        : notSent,
    },
    { label: 'Job ID', value: submission.portalJobId ?? notSent },
    { label: 'Submitted', value: dateAndTime(submission.submittedAt) },
    {
      label: 'The site said',
      value: submission.confirmationText ? (
        <span className="whitespace-pre-wrap">{submission.confirmationText}</span>
      ) : (
        notSent
      ),
    },
    { label: 'Resume', value: submission.resumeFilename ?? notSent },
  ];
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card title="Submission">
        <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {facts.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-text-secondary">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card title={`Submitted answers (${submission.submittedAnswers.length})`}>
        {submission.submittedAnswers.length === 0 ? (
          <p className="text-sm text-text-secondary">No answers were sent.</p>
        ) : (
          <dl className="flex flex-col text-sm">
            {submission.submittedAnswers.map((item, index) => (
              <div
                key={index}
                className="flex flex-col gap-1 border-t border-border-subtle py-3 first:border-t-0 first:pt-0 last:pb-0"
              >
                <dt className="text-text-secondary break-words whitespace-pre-wrap">
                  {item.question}
                </dt>
                <dd className="break-words whitespace-pre-wrap">{item.answer}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  );
}

/** The "Automation details" tab: what the automation reported for this application. */
export function AutomationDetails({ applicationId }: { applicationId: string }) {
  const query = useQuery({
    queryKey: ['application-submissions', applicationId],
    queryFn: ({ signal }) => api.getApplicationSubmissions(applicationId, { signal }),
  });
  if (query.isLoading) return <SkeletonList rows={3} label="Loading the automation details" />;
  if (query.isError || !query.data)
    return (
      <SectionError
        title="Could not load the automation details"
        onRetry={() => void query.refetch()}
      />
    );
  const items = query.data.items;
  if (items.length === 0)
    return (
      <p className="text-sm text-text-secondary">Your automation sent no details for this one.</p>
    );
  return (
    <div className="flex flex-col gap-8">
      {items.map((submission) => (
        <div key={submission.id} className="flex flex-col gap-3">
          {items.length > 1 && (
            <h2 className="text-sm font-semibold">Sent on {dateAndTime(submission.submittedAt)}</h2>
          )}
          <SubmissionDetails submission={submission} />
        </div>
      ))}
    </div>
  );
}
