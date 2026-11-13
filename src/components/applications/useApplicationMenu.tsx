import { useRef, useState } from 'react';
import type { ApplicationResponse } from '../../contracts/application';
import { focusLater, type DialogHandle } from '../../lib/dialogs';
import { ArchiveControl } from '../ArchiveControl';
import type { MenuAction } from '../ui/menu';
import { DeleteApplicationDialog } from './DeleteApplicationDialog';

/**
 * An application's "…" actions: Archive (or Restore) and Delete, none when it cannot be changed.
 * `dialogs` must be in the page; `more` is the button that opened the actions, for focus.
 */
export function useApplicationMenu(application: ApplicationResponse, canEdit: boolean) {
  const archive = useRef<DialogHandle>(null);
  const more = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const archived = !!application.archivedAt;
  const actions: MenuAction[] = canEdit
    ? [
        archived
          ? { label: 'Restore application…', onSelect: () => archive.current?.open() }
          : {
              label: 'Archive application…',
              danger: true,
              onSelect: () => archive.current?.open(),
            },
        { label: 'Delete application…', danger: true, onSelect: () => setDeleting(true) },
      ]
    : [];
  const dialogs = (
    <>
      <ArchiveControl application={application} trigger={false} ref={archive} returnFocus={more} />
      <DeleteApplicationDialog
        application={application}
        open={deleting}
        onClose={() => {
          setDeleting(false);
          focusLater(more);
        }}
      />
    </>
  );
  return { actions, dialogs, more, openArchive: () => archive.current?.open() };
}
