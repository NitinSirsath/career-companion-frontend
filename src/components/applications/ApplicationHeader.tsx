import type { ReactNode } from 'react';
import type { ApplicationResponse } from '../../contracts/application';
import type { mailPeople } from '../../lib/applicationDetail';
import { PageHeader } from '../layout/PageHeader';
import { useIsPhone } from '../layout/useIsPhone';
import { Button } from '../ui/button';
import { OverflowMenu } from '../ui/menu';
import { InlineNotification } from '../ui/notification';
import { ReanalyzeLine } from '../reanalysis/ReanalyzeLine';
import { PhoneApplicationTop } from './PhoneApplicationTop';
import { useApplicationMenu } from './useApplicationMenu';
import { useStatusControl } from './useStatusControl';
import { DeclineQuestion } from './DeclineQuestion';

function ArchivedNotice({ canRestore, onRestore }: { canRestore: boolean; onRestore: () => void }) {
  return (
    <InlineNotification
      action={
        canRestore && (
          <Button variant="ghost" size="sm" className="-my-1.5" onClick={onRestore}>
            Restore
          </Button>
        )
      }
    >
      Archived. Its mails and history stay. Restore it to change its work.
    </InlineNotification>
  );
}

/**
 * Title, role, the status dropdown, and a "…" menu with Archive or Restore and Delete. Notices
 * about the status and the archive sit under it.
 */
export function ApplicationHeader({
  application,
  canEdit,
  breadcrumb,
  people = [],
}: {
  application: ApplicationResponse;
  canEdit: boolean;
  breadcrumb: ReactNode;
  /** The people who wrote its mails, for the phone's fact pills. */
  people?: ReturnType<typeof mailPeople>;
}) {
  const status = useStatusControl(application, canEdit);
  const menu = useApplicationMenu(application, canEdit);
  const phone = useIsPhone();
  const archived = !!application.archivedAt;
  const role = [application.jobTitle, application.location].filter(Boolean).join(' · ');
  const notices = (
    <>
      <ReanalyzeLine target={{ kind: 'application', id: application.id }} />
      {application.decline && (
        <DeclineQuestion
          applicationId={application.id}
          decline={application.decline}
          divider={false}
        />
      )}
      {status.notice}
      {archived && <ArchivedNotice canRestore={canEdit} onRestore={menu.openArchive} />}
    </>
  );
  if (phone)
    return (
      <PhoneApplicationTop
        application={application}
        breadcrumb={breadcrumb}
        status={status.control}
        notices={notices}
        menu={menu}
        people={people}
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="mb-0"
        actionsBesideTitle
        breadcrumb={breadcrumb}
        title={application.companyName}
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {role && <span className="text-sm text-text-secondary">{role}</span>}
            {role && (
              <span aria-hidden="true" className="hidden h-5 w-px bg-border-subtle sm:block" />
            )}
            {status.control}
          </div>
        }
        actions={
          <>
            {canEdit && (
              <OverflowMenu
                label="More actions"
                size="icon"
                triggerRef={menu.more}
                actions={menu.actions}
              />
            )}
            {menu.dialogs}
          </>
        }
      />
      {notices}
    </div>
  );
}
