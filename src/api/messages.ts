import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AdminMessagesResponseSchema,
  AdminSentMessageResponseSchema,
  MyMessagesResponseSchema,
  type MyMessagesResponse,
  type SendOwnerMessageRequest,
} from '../contracts/messages';
import { api } from './client';

/** Messages from the Admin page (owner, 18 Nov 2026). */
export const messageKeys = {
  mine: ['messages', 'mine'] as const,
  sent: ['admin', 'messages'] as const,
};

/** Asked again every 5 minutes and when the app comes back to the front. */
const MINE_EVERY_MS = 5 * 60_000;

export function useMyMessages() {
  return useQuery({
    queryKey: messageKeys.mine,
    queryFn: async ({ signal }) =>
      MyMessagesResponseSchema.parse(await api.get<unknown>('/api/messages', { signal })),
    refetchInterval: MINE_EVERY_MS,
    refetchOnWindowFocus: true,
  });
}

/** Closes a message at once on screen; on every device once the server has it. */
export function useDismissMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<unknown>(`/api/messages/${id}/dismiss`),
    onMutate: (id: string) =>
      queryClient.setQueryData<MyMessagesResponse>(messageKeys.mine, (data) =>
        data ? { messages: data.messages.filter((message) => message.id !== id) } : data,
      ),
    onError: () => void queryClient.invalidateQueries({ queryKey: messageKeys.mine }),
  });
}

export function useSentMessages() {
  return useQuery({
    queryKey: messageKeys.sent,
    queryFn: async ({ signal }) =>
      AdminMessagesResponseSchema.parse(await api.get<unknown>('/api/admin/messages', { signal })),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendOwnerMessageRequest) =>
      AdminSentMessageResponseSchema.parse(await api.post<unknown>('/api/admin/messages', input))
        .message,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.sent });
      void queryClient.invalidateQueries({ queryKey: messageKeys.mine });
    },
  });
}

export function useRemoveMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<unknown>(`/api/admin/messages/${id}/remove`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: messageKeys.sent });
      void queryClient.invalidateQueries({ queryKey: messageKeys.mine });
    },
  });
}
