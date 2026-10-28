import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { gmailStatusKey, markSyncing } from './gmail';
import {
  ListSandboxThreadsResponseSchema,
  ResetSandboxResponseSchema,
  SandboxSendersResponseSchema,
  SandboxSentResponseSchema,
  SandboxThreadDetailSchema,
  type ListSandboxThreadsResponse,
  type ReplySandboxMailRequest,
  type ResetSandboxResponse,
  type SandboxFolder,
  type SandboxSentResponse,
  type SandboxThreadDetail,
  type SendSandboxMailRequest,
} from '../contracts/sandbox';
import { startProcessingRefresh } from '../lib/processingRefresh';

/** Dev mode only: in prod mode the backend answers 404 on every sandbox path. */
export const sandboxKeys = {
  all: ['sandbox'] as const,
  threads: (folder: SandboxFolder, pageToken: string | null) =>
    ['sandbox', 'threads', folder, pageToken] as const,
  thread: (threadId: string) => ['sandbox', 'thread', threadId] as const,
  senders: ['sandbox', 'senders'] as const,
};

export async function listSandboxThreads(
  folder: SandboxFolder,
  pageToken: string | null,
  signal?: AbortSignal,
): Promise<ListSandboxThreadsResponse> {
  const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
  return ListSandboxThreadsResponseSchema.parse(
    await api.get<unknown>(`/api/sandbox/threads?folder=${folder}${page}`, { signal }),
  );
}

export async function readSandboxThread(
  threadId: string,
  signal?: AbortSignal,
): Promise<SandboxThreadDetail> {
  return SandboxThreadDetailSchema.parse(
    await api.get<unknown>(`/api/sandbox/threads/${encodeURIComponent(threadId)}`, { signal }),
  );
}

export async function listSandboxSenders(signal?: AbortSignal): Promise<string[]> {
  const answer = await api.get<unknown>('/api/sandbox/senders', { signal });
  return SandboxSendersResponseSchema.parse(answer).senders;
}

export async function sendSandboxMail(input: SendSandboxMailRequest): Promise<SandboxSentResponse> {
  return SandboxSentResponseSchema.parse(await api.post<unknown>('/api/sandbox/messages', input));
}

export async function replySandboxMail(
  threadId: string,
  input: ReplySandboxMailRequest,
): Promise<SandboxSentResponse> {
  return SandboxSentResponseSchema.parse(
    await api.post<unknown>(`/api/sandbox/threads/${encodeURIComponent(threadId)}/replies`, input),
  );
}

export async function resetSandbox(): Promise<ResetSandboxResponse> {
  return ResetSandboxResponseSchema.parse(
    await api.post<unknown>('/api/sandbox/reset', { confirm: 'RESET' }),
  );
}

export function useSandboxThreads(folder: SandboxFolder, pageToken: string | null) {
  return useQuery({
    queryKey: sandboxKeys.threads(folder, pageToken),
    queryFn: ({ signal }) => listSandboxThreads(folder, pageToken, signal),
  });
}

export function useSandboxThread(threadId: string) {
  return useQuery({
    queryKey: sandboxKeys.thread(threadId),
    queryFn: ({ signal }) => readSandboxThread(threadId, signal),
    retry: false,
  });
}

export function useSandboxSenders() {
  return useQuery({
    queryKey: sandboxKeys.senders,
    queryFn: ({ signal }) => listSandboxSenders(signal),
  });
}

/** A new mail or a reply changes every sandbox view. */
function useSandboxChange<Input, Output>(change: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sandboxKeys.all }),
  });
}

export const useSendSandboxMail = () => useSandboxChange(sendSandboxMail);

export const useReplySandboxMail = (threadId: string) =>
  useSandboxChange((input: ReplySandboxMailRequest) => replySandboxMail(threadId, input));

/** Asks for the same sync as the Gmail Sync page, then keeps the views fresh while it works. */
export function useSyncSandbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.triggerSync(),
    onSuccess: () => markSyncing(queryClient),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: gmailStatusKey });
      void queryClient.invalidateQueries({ queryKey: sandboxKeys.all });
      startProcessingRefresh();
    },
  });
}

/** Deletes the user's sandbox mail and what the app made from it; every cached view is stale. */
export function useResetSandbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetSandbox,
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
