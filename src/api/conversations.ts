import { useEffect } from 'react';
import {
  keepPreviousData,
  onlineManager,
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
  ReplyDraftResponseSchema,
  type Conversation,
  type ConversationDetail,
  type ConversationFilters,
  type LinkConversation,
  type LinkConversationResponse,
  type ListConversationsResponse,
  type ReplyDraftRequest,
  type ReplyDraftResponse,
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

/** The longest wait for a draft: the slowest model's time limit, and some room. */
const REPLY_DRAFT_TIMEOUT_MS = 100_000;

/** An AI draft of the user's reply (owner, 24 Oct 2026). Never stored; nothing is sent. */
export async function writeReplyDraft(
  key: string,
  body: ReplyDraftRequest,
): Promise<ReplyDraftResponse> {
  return ReplyDraftResponseSchema.parse(
    await api.post<unknown>(
      `${conversationPath(key)}/reply-draft`,
      body,
      undefined,
      REPLY_DRAFT_TIMEOUT_MS,
    ),
  );
}

/** Writing a draft is one AI call per click: never retried by itself. */
export function useWriteReplyDraft(key: string) {
  return useMutation({
    retry: false,
    mutationFn: (body: ReplyDraftRequest) => writeReplyDraft(key, body),
  });
}

/** A conversation change can move applications, actions and timelines too. */
function refreshDomain(queryClient: QueryClient) {
  for (const key of DOMAIN_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey: [key] });
}

/** While the AI reads the user's reply, a view asks again this often, until it is read. */
const REPLY_READ_POLL_MS = 3000;
const readingReply = (conversation: Conversation | undefined) =>
  conversation?.request?.replyRead === 'WAITING';

export function useConversations(filters: ConversationFilters, offset: number) {
  return useQuery({
    queryKey: conversationKeys.list(filters, offset),
    queryFn: ({ signal }) => listConversations(filters, offset, signal),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some(readingReply) ? REPLY_READ_POLL_MS : false,
  });
}

export function useConversation(key: string) {
  return useQuery({
    queryKey: conversationKeys.detail(key),
    queryFn: ({ signal }) => getConversation(key, signal),
    refetchInterval: (query) =>
      readingReply(query.state.data?.conversation) ? REPLY_READ_POLL_MS : false,
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
    // Offline, reading a mail changes nothing: it stays new until it is opened online.
    if (key && onlineManager.isOnline()) mutate(key);
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
