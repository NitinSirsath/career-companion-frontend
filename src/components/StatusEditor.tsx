import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, isApiError } from '../api/client';
import {
  ApplicationStatusSchema,
  type ApplicationResponse,
  type ApplicationStatus,
} from '../contracts/application';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';
import { STATUS_LABEL } from '../lib/statusLabels';
import {
  applicationKey,
  applicationQueryOptions,
  applyAcknowledgedApplication,
} from '../lib/applicationCache';

// The editing session is frozen when editing starts. Background reads may update the visible
// server state but never the draft target or its base revision; only an explicit
// "Use current version" captures a new revision.
type Session = {
  applicationId: string;
  baseRevision: number;
  originalUserStatus: ApplicationStatus | null;
  draft: ApplicationStatus | null;
};
type Phase =
  | { kind: 'editing'; message?: string }
  | { kind: 'conflict' }
  | { kind: 'reconciling' }
  | { kind: 'review' } // uncertain save reconciled by reading; user must review before saving again
  | { kind: 'unknown' } // uncertain save and the reconciliation read failed
  | { kind: 'unavailable' };

type SaveVariables = {
  applicationId: string;
  userStatus: ApplicationStatus | null;
  expectedUserStatusRevision: number;
};

const CLEAR = '__clear__';

export function StatusEditor({
  application,
  canEdit,
}: {
  application: ApplicationResponse;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'editing' });
  const [announcement, setAnnouncement] = useState('');
  const openButton = useRef<HTMLButtonElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const selectId = useId();
  const helpId = useId();

  const editing = session !== null;
  useEffect(() => {
    if (editing) select.current?.focus();
  }, [editing]);

  const close = (message = '') => {
    setSession(null);
    setPhase({ kind: 'editing' });
    setAnnouncement(message);
    requestAnimationFrame(() => openButton.current?.focus());
  };

  const reconcile = async (applicationId: string) => {
    setPhase({ kind: 'reconciling' });
    try {
      await queryClient.fetchQuery({ ...applicationQueryOptions(queryClient, applicationId), staleTime: 0 });
      setPhase({ kind: 'review' });
    } catch {
      setPhase({ kind: 'unknown' });
    }
  };

  const mutation = useMutation({
    retry: false, // never resubmit a PATCH automatically
    mutationFn: async ({ applicationId, ...body }: SaveVariables) => {
      // Stop reads that could resolve after the acknowledgement and repaint older state.
      await queryClient.cancelQueries({ queryKey: applicationKey(applicationId) });
      await queryClient.cancelQueries({ queryKey: ['applications'] });
      const result = await api.updateApplicationStatus(applicationId, body);
      // A response for another application is a contract error: the outcome is uncertain and
      // nothing is cached, so caches stay scoped to the captured application.
      if (result.id !== applicationId)
        throw new ApiError('The server returned an unexpected response.', 'contract', 200);
      return result;
    },
    // Cache writes are scoped to the captured application, even after navigation.
    onSuccess: async (result, vars) => {
      await queryClient.cancelQueries({ queryKey: applicationKey(vars.applicationId) });
      await queryClient.cancelQueries({ queryKey: ['applications'] });
      applyAcknowledgedApplication(queryClient, result);
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
      void queryClient.invalidateQueries({ queryKey: applicationKey(vars.applicationId) });
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  const start = () => {
    setSession({
      applicationId: application.id,
      baseRevision: application.userStatusRevision,
      originalUserStatus: application.userStatus,
      draft: application.userStatus,
    });
    setPhase({ kind: 'editing' });
    setAnnouncement('');
  };

  const rebase = () => {
    if (!session) return;
    setSession({
      ...session,
      baseRevision: application.userStatusRevision,
      originalUserStatus: application.userStatus,
    });
    setPhase({ kind: 'editing' });
  };

  const save = () => {
    if (!session || mutation.isPending) return;
    mutation.mutate(
      {
        applicationId: session.applicationId,
        userStatus: session.draft,
        expectedUserStatusRevision: session.baseRevision,
      },
      {
        onSuccess: () => close('Status saved.'),
        onError: (err) => {
          if (isApiError(err) && err.status === 409) {
            setPhase({ kind: 'conflict' });
            void queryClient.invalidateQueries({ queryKey: applicationKey(session.applicationId) });
          } else if (isApiError(err) && err.status === 404) {
            setPhase({ kind: 'unavailable' });
          } else if (isApiError(err) && !err.outcomeUncertain) {
            setPhase({ kind: 'editing', message: err.message });
          } else {
            void reconcile(session.applicationId);
          }
        },
      },
    );
  };

  if (!session) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button ref={openButton} size="sm" variant="tertiary" onClick={start} disabled={!canEdit}>
          Change status
        </Button>
        {!canEdit && (
          <p className="text-xs text-text-secondary">Editing is unavailable until this application loads correctly.</p>
        )}
        <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      </div>
    );
  }

  const stale = application.userStatusRevision !== session.baseRevision;
  const blocked =
    mutation.isPending ||
    !canEdit ||
    ['conflict', 'reconciling', 'review', 'unknown', 'unavailable'].includes(phase.kind);
  const current = application.userStatus ? STATUS_LABEL[application.userStatus] : 'none (using AI status)';
  const aiLabel = application.aiStatus ? STATUS_LABEL[application.aiStatus] : 'unknown';

  return (
    <form
      className="w-full space-y-3 border border-border-default bg-surface-subtle p-4"
      aria-label="Edit application status"
      aria-busy={mutation.isPending}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !mutation.isPending) close();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={selectId}>Your status</Label>
        <NativeSelect
          id={selectId}
          ref={select}
          aria-describedby={helpId}
          value={session.draft ?? CLEAR}
          disabled={mutation.isPending}
          onChange={(e) =>
            setSession({
              ...session,
              draft: e.target.value === CLEAR ? null : ApplicationStatusSchema.parse(e.target.value),
            })
          }
        >
          {ApplicationStatusSchema.options.map((status) => (
            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
          ))}
          <option value={CLEAR}>Use AI status (clear my status)</option>
        </NativeSelect>
        <p id={helpId} className="text-xs text-text-secondary">
          Clearing uses the latest stored AI status ({aiLabel}) and does not rerun AI. Changing the
          status does not complete actions or send notifications.
        </p>
      </div>

      <div role="status" aria-live="polite" className="text-sm space-y-2">
        {mutation.isPending && <p>Saving…</p>}
        {phase.kind === 'reconciling' && <p>Checking whether your change was saved…</p>}
      </div>
      <div role="alert" className="text-sm space-y-2">
        {phase.kind === 'editing' && phase.message && <p className="text-status-error">{phase.message}</p>}
        {phase.kind === 'editing' && stale && (
          <p>This status changed after you started editing (now: {current}). Saving will be rejected until you review it.</p>
        )}
        {phase.kind === 'conflict' && (
          <p>
            This status was changed elsewhere, for example in another tab. Current status: {current}.
            Your selection is kept. Review it, then choose “Use current version” to continue.
          </p>
        )}
        {phase.kind === 'review' && (
          <p>
            We couldn't confirm whether your change was saved. Current status: {current}. Review it, then
            choose “Use current version” before saving again.
          </p>
        )}
        {phase.kind === 'unknown' && (
          <p className="text-status-error">Save outcome unknown. The current status could not be loaded.</p>
        )}
        {phase.kind === 'unavailable' && (
          <p className="text-status-error">This application is no longer available.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={blocked}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        {(stale || phase.kind === 'conflict' || phase.kind === 'review') && (
          <Button
            type="button"
            size="sm"
            variant="tertiary"
            onClick={rebase}
            disabled={!canEdit || mutation.isPending || (phase.kind === 'conflict' && !stale)}
          >
            Use current version
          </Button>
        )}
        {phase.kind === 'unknown' && (
          <Button type="button" size="sm" variant="tertiary" onClick={() => void reconcile(session.applicationId)}>
            Retry loading status
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={() => close()} disabled={mutation.isPending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
