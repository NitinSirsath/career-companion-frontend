import { useRef, useState, type ReactNode } from 'react';
import type { ApplicationResponse } from '../../contracts/application';
import { focusLater, type DialogHandle } from '../../lib/dialogs';
import { ArchiveControl } from '../ArchiveControl';
import { DeleteApplicationDialog } from './DeleteApplicationDialog';
import { PageHeader } from '../layout/PageHeader';
import { Button } from '../ui/button';
import { OverflowMenu } from '../ui/menu';
import { InlineNotification } from '../ui/notification';
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
  const archive = useRef<DialogHandle>(null);
  const more = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const archived = !!application.archivedAt;
  const role = [application.jobTitle, application.location].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="mb-0"
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
                triggerRef={more}
                actions={[
                  archived
                    ? { label: 'Restore application…', onSelect: () => archive.current?.open() }
                    : {
                        label: 'Archive application…',
                        danger: true,
                        onSelect: () => archive.current?.open(),
                      },
                  { label: 'Delete application…', danger: true, onSelect: () => setDeleting(true) },
                ]}
              />
            )}
            <ArchiveControl
              application={application}
              trigger={false}
              ref={archive}
              returnFocus={more}
            />
            <DeleteApplicationDialog
              application={application}
              open={deleting}
              onClose={() => {
                setDeleting(false);
                focusLater(more);
              }}
            />
          </>
        }
      />
      {status.notice}
      {archived && (
        <ArchivedNotice canRestore={canEdit} onRestore={() => archive.current?.open()} />
      )}
    </div>
  );
}
