import { useRef, useState } from 'react';
import { useAISettings } from '../../api/aiSettings';
import { useConversations } from '../../api/conversations';
import { useReanalyzing } from '../../api/reanalysis';
import type { ApplicationResponse } from '../../contracts/application';
import { focusLater, type DialogHandle } from '../../lib/dialogs';
import { ArchiveControl } from '../ArchiveControl';
import { ReanalyzeDialog } from '../reanalysis/ReanalyzeDialog';
import { AiIcon } from '../ui/ai-icon';
import type { MenuAction } from '../ui/menu';
import { DeleteApplicationDialog } from './DeleteApplicationDialog';

/**
 * "Reanalyze…" for an application (owner, 19 Nov 2026): the AI reads its conversations again.
 * Not for an archived one, one with no mails (made by NorthList Apply only), or while the AI is
 * not set up; off while it runs. The mail list is the page's own query, so no extra request.
 */
function useReanalyzeApplication(application: ApplicationResponse, canEdit: boolean) {
  const [open, setOpen] = useState(false);
  const settings = useAISettings();
  const mails = useConversations({ application: application.id }, 0);
  const target = { kind: 'application' as const, id: application.id };
  const running = useReanalyzing(target, canEdit);
  const shown =
    canEdit &&
    !application.archivedAt &&
    (mails.data?.items.length ?? 0) > 0 &&
    settings.data?.access.state !== 'NOT_SET_UP';
  const action: MenuAction | null = shown
    ? {
        label: running ? 'Reanalyzing…' : 'Reanalyze…',
        disabled: running,
        icon: <AiIcon size={18} aria-hidden="true" className="shrink-0" />,
        onSelect: () => setOpen(true),
      }
    : null;
  return { action, open, close: () => setOpen(false), target };
}

/**
 * An application's "…" actions: Reanalyze, Archive (or Restore) and Delete, none when it cannot be
 * changed. `dialogs` must be in the page; `more` is the button that opened the actions, for focus.
 */
export function useApplicationMenu(application: ApplicationResponse, canEdit: boolean) {
  const archive = useRef<DialogHandle>(null);
  const more = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const reanalyze = useReanalyzeApplication(application, canEdit);
  const archived = !!application.archivedAt;
  const actions: MenuAction[] = canEdit
    ? [
        ...(reanalyze.action ? [reanalyze.action] : []),
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
      <ReanalyzeDialog
        target={reanalyze.target}
        open={reanalyze.open}
        onClose={() => {
          reanalyze.close();
          focusLater(more);
        }}
      />
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
