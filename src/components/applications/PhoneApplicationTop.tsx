import { useState, type ReactNode } from 'react';
import { ExternalLinkIcon } from 'lucide-react';
import type { ApplicationResponse } from '../../contracts/application';
import { appliedLine, type mailPeople } from '../../lib/applicationDetail';
import { safeHttpUrl } from '../../lib/safeUrl';
import { PhoneTitle } from '../phone/PhoneTitle';
import { Avatar } from '../ui/avatar';
import { PhoneApplicationMore } from './PhoneApplicationMore';
import { PILL } from './DetailSection';
import { Ring } from '../ui/ring';
import { StatusPickerContext } from './statusPicker';
import type { useApplicationMenu } from './useApplicationMenu';

/** The facts as pills in one round card: status, to-dos, the people who wrote, the job post. */
function FactCard({
  application,
  status,
  people,
}: {
  application: ApplicationResponse;
  status: ReactNode;
  people: ReturnType<typeof mailPeople>;
}) {
  const jobPost = safeHttpUrl(application.automation?.jobUrl ?? null);
  const todo = application.pendingActionCount;
  return (
    <div
      role="group"
      aria-label="About this application"
      className="mx-[-6px] flex flex-wrap gap-[7px] rounded-[22px] bg-surface-subtle p-2"
    >
      {status}
      {todo > 0 && (
        <span className={PILL}>
          <Ring kind="todo" size={13} />
          {todo} to do
        </span>
      )}
      {people.map((person) => (
        <span key={person.address ?? person.name} className={PILL} title={person.address ?? ''}>
          <Avatar name={person.name} className="size-[19px] text-[8.5px]" />
          {person.name}
        </span>
      ))}
      {jobPost && (
        <a href={jobPost} target="_blank" rel="noopener noreferrer" className={PILL}>
          <ExternalLinkIcon size={15} aria-hidden="true" className="text-text-secondary" />
          Job post
        </a>
      )}
    </div>
  );
}

/**
 * The top of an application on a phone (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 6),
 * laid out like a mail: a grey "Applied … · via …" line, the big company name, the role and place,
 * then the facts as pills in one round card. The status pill opens the status sheet; ··· in the
 * top bar has Reply, Archive or Restore, and Delete.
 */
export function PhoneApplicationTop({
  application,
  breadcrumb,
  status,
  notices,
  menu,
  people,
}: {
  application: ApplicationResponse;
  breadcrumb: ReactNode;
  status: ReactNode;
  notices: ReactNode;
  menu: ReturnType<typeof useApplicationMenu>;
  people: ReturnType<typeof mailPeople>;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {breadcrumb}
      <header className="flex flex-col px-1 pt-0.5">
        <p className="text-phone-sub text-text-secondary">{appliedLine(application)}</p>
        <PhoneTitle size="detail" className="pt-[3px] pb-2">
          {application.companyName}
        </PhoneTitle>
        {application.jobTitle || application.location ? (
          <p className="truncate pb-3 text-[14px]">
            {application.jobTitle}
            {application.location && (
              <span className="text-text-secondary">
                {application.jobTitle ? ' · ' : ''}
                {application.location}
              </span>
            )}
          </p>
        ) : null}
        <StatusPickerContext.Provider value={{ open: picking, onOpenChange: setPicking }}>
          <FactCard application={application} status={status} people={people} />
        </StatusPickerContext.Provider>
      </header>
      {notices}
      {menu.dialogs}
      <PhoneApplicationMore applicationId={application.id} actions={menu.actions} />
    </div>
  );
}
