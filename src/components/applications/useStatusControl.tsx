import { useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '../../api/client';
import type { ApplicationResponse, ApplicationStatus } from '../../contracts/application';
import {
  applicationKey,
  applicationQueryOptions,
  applyAcknowledgedApplication,
} from '../../lib/applicationCache';
import { phaseAfterError, USE_AI, type Choice, type Phase } from '../../lib/statusChoice';
import { applicationTag, statusTag } from '../../lib/statusTags';
import { StatusLine, StatusNotice } from './StatusSelect';

interface SaveVariables {
  applicationId: string;
  userStatus: ApplicationStatus | null;
  expectedUserStatusRevision: number;
}

function useStatusSave() {
  const queryClient = useQueryClient();
  return useMutation({
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
}

/**
 * The application's status in the page header: a dropdown that saves the choice at once, and the
 * notice that goes with it, shown under the header. Each save uses the revision the page shows,
 * so a change made elsewhere is never overwritten.
 */
export function useStatusControl(
  application: ApplicationResponse,
  canEdit: boolean,
): { control: ReactNode; notice: ReactNode } {
  const queryClient = useQueryClient();
  const save = useStatusSave();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [announcement, setAnnouncement] = useState('');
  const noticeBox = useRef<HTMLDivElement>(null);
  // After a failed save, focus moves to the notice that explains it.
  const focusNotice = () => requestAnimationFrame(() => noticeBox.current?.focus());

  const reconcile = async (applicationId: string) => {
    setPhase({ kind: 'reconciling' });
    try {
      await queryClient.fetchQuery({
        ...applicationQueryOptions(queryClient, applicationId),
        staleTime: 0,
      });
      setPhase({ kind: 'review' });
    } catch {
      setPhase({ kind: 'unknown' });
    }
    focusNotice();
  };

  const choose = (choice: Choice) => {
    const userStatus = choice === USE_AI ? null : choice;
    const blocked = ['saving', 'reconciling', 'unknown', 'unavailable'].includes(phase.kind);
    if (blocked || !canEdit || userStatus === application.userStatus) return;
    const applicationId = application.id;
    setAnnouncement('');
    setPhase({ kind: 'saving', draft: userStatus });
    save.mutate(
      { applicationId, userStatus, expectedUserStatusRevision: application.userStatusRevision },
      {
        onSuccess: () => {
          setPhase({ kind: 'idle' });
          setAnnouncement('Status saved.');
        },
        onError: (error) => {
          const next = phaseAfterError(error, userStatus);
          if (next === 'reconcile') return void reconcile(applicationId);
          setPhase(next);
          if (next.kind === 'conflict')
            void queryClient.invalidateQueries({ queryKey: applicationKey(applicationId) });
          focusNotice();
        },
      },
    );
  };

  const saving = phase.kind === 'saving';
  const shown = saving
    ? statusTag(phase.draft ?? application.aiStatus)
    : applicationTag(application);
  const value: Choice = (saving ? phase.draft : application.userStatus) ?? USE_AI;
  const locked = ['reconciling', 'unknown', 'unavailable'].includes(phase.kind);

  const control = (
    <StatusLine
      application={application}
      value={value}
      shown={shown}
      disabled={!canEdit || saving || locked}
      busy={saving}
      announcement={announcement}
      onChoose={choose}
    />
  );
  const notice = (
    <div ref={noticeBox} tabIndex={-1} className="outline-none empty:hidden">
      {!application.archivedAt && (
        <StatusNotice
          phase={phase}
          application={application}
          onUseAi={() => choose(USE_AI)}
          onCheckAgain={() => void reconcile(application.id)}
          onClose={() => setPhase({ kind: 'idle' })}
        />
      )}
    </div>
  );
  return { control, notice };
}
