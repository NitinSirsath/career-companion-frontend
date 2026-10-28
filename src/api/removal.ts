/**
 * Deleting from NorthList and blocking a company's new mail (owner, 26 Oct 2026). Gmail is never
 * changed: the app can only read it.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './client';
import {
  BlockedSenderSchema,
  DeleteConversationResponseSchema,
  ListBlockedSendersResponseSchema,
  type DeleteConversationRequest,
} from '../contracts/blockedSender';
import { DOMAIN_QUERY_KEYS } from '../lib/processingRefresh';

export const blockedSenderKeys = { all: ['blockedSenders'] as const };

const conversationPath = (key: string) => `/api/conversations/${encodeURIComponent(key)}`;

/** A delete moves conversations, applications, steps and timelines. */
function refreshAfterDelete(queryClient: QueryClient) {
  for (const key of DOMAIN_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
}

/** The companies whose new mail the app does not read: the Restricted list. */
export function useBlockedSenders() {
  return useQuery({
    queryKey: blockedSenderKeys.all,
    queryFn: async ({ signal }) =>
      ListBlockedSendersResponseSchema.parse(
        await api.get<unknown>('/api/blocked-senders', { signal }),
      ),
  });
}

/** Blocks the company of a conversation's newest job mail; the conversation stays. */
export function useBlockSender(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      BlockedSenderSchema.parse(await api.post<unknown>(`${conversationPath(key)}/block`, {})),
    onSettled: () => queryClient.invalidateQueries({ queryKey: blockedSenderKeys.all }),
  });
}

export function useUnblockSender() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<unknown>(`/api/blocked-senders/${id}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: blockedSenderKeys.all }),
  });
}

/** Deletes a conversation from the app, and blocks its company when asked. */
export function useDeleteConversation(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (body: DeleteConversationRequest) =>
      DeleteConversationResponseSchema.parse(
        await api.delete<unknown>(conversationPath(key), body),
      ),
    onSettled: () => {
      refreshAfterDelete(queryClient);
      void queryClient.invalidateQueries({ queryKey: blockedSenderKeys.all });
    },
  });
}

/** Deletes an application from the app; its mails stay, no longer linked. */
export function useDeleteApplication(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: () => api.delete<unknown>(`/api/applications/${id}`),
    onSettled: () => refreshAfterDelete(queryClient),
  });
}
