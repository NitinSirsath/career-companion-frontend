import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApplicationResponse } from '../contracts/application';
import { applyAcknowledgedApplication } from '../lib/applicationCache';
import {
  focusLater,
  refreshFollowThrough,
  type DialogHandle,
  type TriggerOptions,
} from '../lib/dialogs';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { InlineNotification } from './ui/notification';

/** Archives or restores an application, after the user confirms. */
export function ArchiveControl({
  application,
  disabled = false,
  ref,
  trigger: showTrigger = true,
  returnFocus,
}: {
  application: ApplicationResponse;
  disabled?: boolean;
  ref?: Ref<DialogHandle>;
} & TriggerOptions) {
  const client = useQueryClient(),
    trigger = useRef<HTMLButtonElement>(null);
  const [snapshot, setSnapshot] = useState<ApplicationResponse | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const giveFocusBack = () => focusLater(showTrigger ? trigger : returnFocus);
  const close = () => {
    if (!pending) {
      setSnapshot(null);
      giveFocusBack();
    }
  };
  const begin = () => {
    setSnapshot(application);
    setError('');
  };
  useImperativeHandle(ref, () => ({ open: begin }));
  const save = async () => {
    if (!snapshot || pending || error) return;
    setPending(true);
    try {
      const saved = await api.archiveApplication(snapshot.id, {
        expectedArchiveRevision: snapshot.archiveRevision,
        archived: !snapshot.archivedAt,
      });
      applyAcknowledgedApplication(client, saved);
      setSnapshot(null);
      giveFocusBack();
    } catch {
      setError('We could not confirm the change. Close this and look at the application again.');
    } finally {
      setPending(false);
      await refreshFollowThrough(client);
    }
  };
  const restore = !!snapshot?.archivedAt;
  const name = [application.companyName, application.jobTitle].filter(Boolean).join(' · ');
  return (
    <>
      {showTrigger && (
        <Button ref={trigger} size="sm" variant="tertiary" disabled={disabled} onClick={begin}>
          {application.archivedAt ? 'Restore application' : 'Archive application'}
        </Button>
      )}
      <Dialog
        open={!!snapshot}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <p className="text-xs text-text-secondary">{name}</p>
            <DialogTitle>
              {restore ? 'Restore this application?' : 'Archive this application?'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            {restore
              ? 'It comes back to your active list with its open to-dos. Earlier reminders are not sent again.'
              : 'It leaves your active list, to-dos and agenda. Its status, history and mails stay, and new mail for it is still read. Restore it before you add or change work.'}
          </p>
          {error && (
            <InlineNotification kind="error" className="mt-6">
              {error}
            </InlineNotification>
          )}
          <DialogFooter>
            <Button disabled={pending} variant="secondary" onClick={close}>
              Close
            </Button>
            <Button
              variant={restore ? 'primary' : 'danger'}
              disabled={pending || !!error}
              onClick={() => void save()}
            >
              {restore ? 'Restore' : 'Archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
