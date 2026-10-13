import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from './client';
import { conversationKeys } from './conversations';
import {
  ListMailboxThreadsResponseSchema,
  MailThreadSchema,
  SendMailReplyResponseSchema,
  type ListMailboxThreadsResponse,
  type MailThread,
  type SendMailReplyRequest,
  type SendMailReplyResponse,
} from '../contracts/mailbox';

/** The backend gives Gmail 20 seconds to answer; wait a little longer than that. */
const MAILBOX_TIMEOUT_MS = 25_000;
/** A reply reads the conversation (20 seconds) and then sends (30 seconds); wait past both. */
const SEND_REPLY_TIMEOUT_MS = 60_000;

export const mailboxKeys = {
  threads: (pageToken: string | null) => ['mailbox', 'threads', pageToken] as const,
  thread: (threadId: string) => ['mailbox', 'thread', threadId] as const,
};

export async function listMailboxThreads(
  pageToken: string | null,
  signal?: AbortSignal,
): Promise<ListMailboxThreadsResponse> {
  const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
  return ListMailboxThreadsResponseSchema.parse(
    await api.get<unknown>(`/api/mailbox/threads${query}`, { signal }, MAILBOX_TIMEOUT_MS),
  );
}

export async function readMailThread(threadId: string, signal?: AbortSignal): Promise<MailThread> {
  return MailThreadSchema.parse(
    await api.get<unknown>(
      `/api/mailbox/threads/${encodeURIComponent(threadId)}`,
      { signal },
      MAILBOX_TIMEOUT_MS,
    ),
  );
}

export async function sendMailReply(
  threadId: string,
  input: SendMailReplyRequest,
): Promise<SendMailReplyResponse> {
  return SendMailReplyResponseSchema.parse(
    await api.post<unknown>(
      `/api/mailbox/threads/${encodeURIComponent(threadId)}/replies`,
      input,
      undefined,
      SEND_REPLY_TIMEOUT_MS,
    ),
  );
}

/** Always a file download: the backend never lets the browser show an attached file. */
export const attachmentUrl = (messageId: string, partId: string): string =>
  `/api/mailbox/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(partId)}`;

/**
 * Mail is read live from Gmail and never kept: nothing stays in the cache once the page is left,
 * a failed read is shown instead of retried, and coming back to the window does not read again.
 */
const LIVE_READ = { retry: false, gcTime: 0, refetchOnWindowFocus: false } as const;

export function useMailboxThreads(pageToken: string | null) {
  return useQuery({
    queryKey: mailboxKeys.threads(pageToken),
    queryFn: ({ signal }) => listMailboxThreads(pageToken, signal),
    ...LIVE_READ,
  });
}

export function useMailThread(threadId: string) {
  return useQuery({
    queryKey: mailboxKeys.thread(threadId),
    queryFn: ({ signal }) => readMailThread(threadId, signal),
    ...LIVE_READ,
  });
}

const GMAIL_STATUS_KEY = ['gmailStatus'] as const;

/** The Gmail connection status, which the app shell already keeps fresh. */
const useGmailStatus = () =>
  useQuery({
    queryKey: GMAIL_STATUS_KEY,
    queryFn: ({ signal }) => api.getGmailStatus({ signal }),
  });

export function useGmailAddress(): string | null {
  return useGmailStatus().data?.gmailEmail ?? null;
}

/** False when Gmail is connected for reading only; undefined while that is not known yet. */
export function useCanSendMail(): boolean | undefined {
  const { data } = useGmailStatus();
  return data ? data.canSend === true : undefined;
}

/**
 * Sends a reply once. It is never repeated by the app: after any outcome the conversation is read
 * again, so the user sees for themselves whether the reply is there.
 */
export function useSendMailReply(threadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMailReplyRequest) => sendMailReply(threadId, input),
    retry: false,
    onError: (error) => {
      // The backend learned that this connection may not send: show "Allow sending".
      if (isApiError(error) && error.code === 'GMAIL_SEND_NOT_ALLOWED')
        void queryClient.invalidateQueries({ queryKey: GMAIL_STATUS_KEY });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: mailboxKeys.thread(threadId) });
      // A sent reply turns the conversation's request to "Replied".
      void queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}
