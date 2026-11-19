import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ReanalysisRunSchema,
  ReanalysisStatusSchema,
  type ReanalysisRun,
} from '../contracts/reanalysis';
import { api } from './client';

/**
 * Reanalyze (owner, 19 Nov 2026): the newest run of a conversation or an application, what a new
 * one would read (only while the confirm is open), and starting one. While a run is open its
 * status is asked again every 3 seconds, for at most 10 minutes, never for good.
 */
export type ReanalysisTarget =
  { kind: 'conversation'; key: string } | { kind: 'application'; id: string };

const path = (target: ReanalysisTarget) =>
  target.kind === 'conversation'
    ? `/api/conversations/${encodeURIComponent(target.key)}/reanalyze`
    : `/api/applications/${encodeURIComponent(target.id)}/reanalyze`;

const targetId = (target: ReanalysisTarget) =>
  target.kind === 'conversation' ? target.key : target.id;

export const reanalysisKeys = {
  all: ['reanalysis'] as const,
  run: (target: ReanalysisTarget) => ['reanalysis', target.kind, targetId(target), 'run'] as const,
  preview: (target: ReanalysisTarget) =>
    ['reanalysis', target.kind, targetId(target), 'preview'] as const,
};

const POLL_MS = 3000;
const POLL_LIMIT_MS = 10 * 60_000;

/** A run that is queued or reading now. */
export const runOpen = (run: ReanalysisRun | null | undefined) =>
  run?.state === 'QUEUED' || run?.state === 'RUNNING';

const getStatus = async (target: ReanalysisTarget, preview: boolean, signal?: AbortSignal) =>
  ReanalysisStatusSchema.parse(
    await api.get<unknown>(`${path(target)}${preview ? '?preview=1' : ''}`, { signal }),
  );

/** The newest run, asked again every 3 seconds while it reads. */
export function useReanalysisRun(target: ReanalysisTarget, enabled = true) {
  return useQuery({
    queryKey: reanalysisKeys.run(target),
    queryFn: ({ signal }) => getStatus(target, false, signal).then((status) => status.run),
    enabled,
    refetchInterval: (query) => {
      const run = query.state.data;
      return run && runOpen(run) && Date.now() - Date.parse(run.createdAt) < POLL_LIMIT_MS
        ? POLL_MS
        : false;
    },
  });
}

/** What a new run would read now: only while the confirm is open. */
export function useReanalysisPreview(target: ReanalysisTarget, open: boolean) {
  return useQuery({
    queryKey: reanalysisKeys.preview(target),
    queryFn: ({ signal }) => getStatus(target, true, signal).then((status) => status.preview),
    enabled: open,
    staleTime: 0,
  });
}

/** Starts a run. A refusal comes back with the reason, for the confirm to show. */
export function useStartReanalysis(target: ReanalysisTarget) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => ReanalysisRunSchema.parse(await api.post<unknown>(path(target), {})),
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey: reanalysisKeys.all }),
  });
}

/** True while the conversation or application is being reanalyzed: its menu item is off. */
export function useReanalyzing(target: ReanalysisTarget, enabled = true) {
  return runOpen(useReanalysisRun(target, enabled).data);
}
