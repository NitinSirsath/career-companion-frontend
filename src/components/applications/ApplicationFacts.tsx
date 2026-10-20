import type { ReactNode } from 'react';
import type { ApplicationEventResponse, ApplicationResponse } from '../../contracts/application';
import { longDate, mailPeople } from '../../lib/applicationDetail';
import { Avatar } from '../ui/avatar';

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 bg-surface px-6 py-5">
      <h2 className="text-xs tracking-[0.32px] text-text-secondary">{title}</h2>
      {children}
    </section>
  );
}

/** The side column: the application's facts, and the people who wrote its mails. */
export function ApplicationFacts({
  application,
  events,
}: {
  application: ApplicationResponse;
  /** The history the page has loaded, to find who wrote its mails. */
  events: readonly ApplicationEventResponse[];
}) {
  const applied = application.appliedAt ? (
    longDate(application.appliedAt)
  ) : (
    <span className="text-text-secondary">Unknown</span>
  );
  const rows: { label: string; value: ReactNode }[] = [
    { label: 'Applied', value: applied },
    { label: 'Added', value: longDate(application.createdAt) },
  ];
  if (application.location) rows.push({ label: 'Location', value: application.location });
  if (application.submittedVia === 'AUTOMATION')
    rows.push({ label: 'Sent by', value: 'Your automation' });
  const people = mailPeople(events);
  return (
    <aside aria-label="About this application" className="flex flex-col gap-4 lg:sticky lg:top-6">
      <Card title="Details">
        <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          {rows.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-text-secondary">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      {people.length > 0 && (
        <Card title="People in its mails">
          <ul className="flex flex-col gap-3">
            {people.map((person) => (
              <li key={person.address ?? person.name} className="flex items-center gap-3">
                <Avatar name={person.name} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{person.name}</span>
                  {person.address && (
                    <span className="truncate text-xs text-text-secondary">{person.address}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </aside>
  );
}
