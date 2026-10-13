import { useEffect } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from './client';
import {
  ConversationDetailSchema,
  ConversationSchema,
  LinkConversationResponseSchema,
  ListConversationsResponseSchema,
  type Conversation,
  type ConversationDetail,
  type ConversationFilters,
  type LinkConversation,
  type LinkConversationResponse,
  type ListConversationsResponse,
  type SetRequestState,
} from '../contracts/conversation';
import { DOMAIN_QUERY_KEYS } from '../lib/processingRefresh';

export const CONVERSATION_PAGE_SIZE = 20;

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: ['conversations', 'list'] as const,
  list: (filters: ConversationFilters, offset: number) =>
    ['conversations', 'list', filters, offset] as const,
  detail: (key: string) => ['conversations', 'detail', key] as const,
};

const conversationPath = (key: string) => `/api/conversations/${encodeURIComponent(key)}`;

export async function listConversations(
  filters: ConversationFilters,
  offset: number,
  signal?: AbortSignal,
): Promise<ListConversationsResponse> {
  const query = new URLSearchParams({
    limit: String(CONVERSATION_PAGE_SIZE),
    offset: String(offset),
  });
  for (const [name, value] of Object.entries(filters)) if (value) query.set(name, value);
  return ListConversationsResponseSchema.parse(
    await api.get<unknown>(`/api/conversations?${query}`, { signal }),
  );
}

/** `key` is the conversation's own key, or the ID of any of its emails. */
export async function getConversation(
  key: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  return ConversationDetailSchema.parse(await api.get<unknown>(conversationPath(key), { signal }));
}

export async function markConversationSeen(key: string): Promise<void> {
  await api.post<unknown>(`${conversationPath(key)}/seen`, {});
}

export async function setRequestState(key: string, body: SetRequestState): Promise<Conversation> {
  return ConversationSchema.parse(
    await api.patch<unknown>(`${conversationPath(key)}/request`, body),
  );
}

export async function linkConversation(
  key: string,
  body: LinkConversation,
): Promise<LinkConversationResponse> {
  return LinkConversationResponseSchema.parse(
    await api.post<unknown>(`${conversationPath(key)}/application`, body),
  );
}

/** A conversation change can move applications, actions and timelines too. */
function refreshDomain(queryClient: QueryClient) {
  for (const key of DOMAIN_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
}

export function useConversations(filters: ConversationFilters, offset: number) {
  return useQuery({
    queryKey: conversationKeys.list(filters, offset),
    queryFn: ({ signal }) => listConversations(filters, offset, signal),
    placeholderData: keepPreviousData,
  });
}

export function useConversation(key: string) {
  return useQuery({
    queryKey: conversationKeys.detail(key),
    queryFn: ({ signal }) => getConversation(key, signal),
  });
}

/**
 * Opening a conversation ends its "new" mark: once, with the conversation's own key. Only the
 * lists are refreshed, so the open page keeps showing the mark until the user leaves it.
 */
export function useMarkSeenOnOpen(conversation: Conversation | undefined) {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: markConversationSeen,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: conversationKeys.lists }),
  });
  const key = conversation?.isNew ? conversation.key : null;
  useEffect(() => {
    if (key) mutate(key);
  }, [key, mutate]);
}

/** Refreshes after a refusal too: the row then shows what changed in the meantime. */
export function useSetRequestState(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetRequestState) => setRequestState(key, body),
    onSettled: () => refreshDomain(queryClient),
  });
}

/** Never replayed automatically: one click creates at most one application. */
export function useLinkConversation(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LinkConversation) => linkConversation(key, body),
    retry: false,
    onSettled: () => refreshDomain(queryClient),
  });
}
