import type { ReactNode } from 'react';
import type { ApplicationEventResponse, ApplicationResponse } from '../../contracts/application';
import { longDate, mailPeople } from '../../lib/applicationDetail';
import { useIsPhone } from '../layout/useIsPhone';
import { Avatar } from '../ui/avatar';
import { PHONE_ROW, PhoneGroupSection as PhoneSection } from '../phone/PhoneList';

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 panel p-6">
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** The facts and the people on a phone, as grouped lists. */
function PhoneFacts({
  rows,
  people,
}: {
  rows: { label: string; value: ReactNode }[];
  people: ReturnType<typeof mailPeople>;
}) {
  return (
    <div aria-label="About this application" role="group" className="flex flex-col gap-6">
      <PhoneSection title="Details">
        {rows.map(({ label, value }) => (
          <div
            key={label}
            className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5 text-[15px]"
          >
            <span className="text-text-secondary">{label}</span>
            <span className="min-w-0 text-right break-words">{value}</span>
          </div>
        ))}
      </PhoneSection>
      {people.length > 0 && (
        <PhoneSection title="People in its mails">
          {people.map((person) => (
            <div key={person.address ?? person.name} className={PHONE_ROW}>
              <Avatar name={person.name} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px]">{person.name}</span>
                {person.address && (
                  <span className="truncate text-[13px] text-text-secondary">{person.address}</span>
                )}
              </span>
            </div>
          ))}
        </PhoneSection>
      )}
    </div>
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
    rows.push({ label: 'Sent by', value: 'NorthList Apply' });
  const people = mailPeople(events);
  const phone = useIsPhone();
  // Phones: label-left, value-right rows on a grouped list (owner, 12 Nov 2026).
  if (phone) return <PhoneFacts rows={rows} people={people} />;
  return (
    <aside aria-label="About this application" className="flex flex-col gap-4 lg:sticky lg:top-20">
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
