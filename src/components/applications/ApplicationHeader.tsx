import { useState, type ReactNode } from 'react';
import type { ApplicationResponse } from '../../contracts/application';
import { PageHeader } from '../layout/PageHeader';
import { useIsPhone } from '../layout/useIsPhone';
import { PhoneTitle } from '../phone/PhoneTitle';
import { Button } from '../ui/button';
import { OverflowMenu } from '../ui/menu';
import { InlineNotification } from '../ui/notification';
import { PhoneApplicationBar } from './PhoneApplicationBar';
import { StatusPickerContext } from './statusPicker';
import { useApplicationMenu } from './useApplicationMenu';
import { useStatusControl } from './useStatusControl';

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
 * The top of an application on a phone (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): the
 * big company name that scrolls under the top bar, the role and the status, and a floating action
 * bar with Reply, Status and More. The status picks from a sheet.
 */
function PhoneApplicationHeader({
  application,
  canEdit,
  breadcrumb,
  role,
  status,
  notices,
  menu,
}: {
  application: ApplicationResponse;
  canEdit: boolean;
  breadcrumb: ReactNode;
  role: string;
  status: ReactNode;
  notices: ReactNode;
  menu: ReturnType<typeof useApplicationMenu>;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {breadcrumb}
      <header className="flex flex-col gap-[9px] px-1 pt-0.5">
        <PhoneTitle size="detail">{application.companyName}</PhoneTitle>
        {role && <p className="text-[15px] text-text-secondary">{role}</p>}
        <StatusPickerContext.Provider value={{ open: picking, onOpenChange: setPicking }}>
          {status}
        </StatusPickerContext.Provider>
      </header>
      {notices}
      {menu.dialogs}
      <PhoneApplicationBar
        applicationId={application.id}
        onStatus={() => setPicking(true)}
        canPick={canEdit && !application.archivedAt}
        actions={menu.actions}
      />
    </div>
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
}: {
  application: ApplicationResponse;
  canEdit: boolean;
  breadcrumb: ReactNode;
}) {
  const status = useStatusControl(application, canEdit);
  const menu = useApplicationMenu(application, canEdit);
  const phone = useIsPhone();
  const archived = !!application.archivedAt;
  const role = [application.jobTitle, application.location].filter(Boolean).join(' · ');
  const notices = (
    <>
      {status.notice}
      {archived && <ArchivedNotice canRestore={canEdit} onRestore={menu.openArchive} />}
    </>
  );
  if (phone)
    return (
      <PhoneApplicationHeader
        application={application}
        canEdit={canEdit}
        breadcrumb={breadcrumb}
        role={role}
        status={status.control}
        notices={notices}
        menu={menu}
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
