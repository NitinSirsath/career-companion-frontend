import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import {
  ListMailboxThreadsResponseSchema,
  MailThreadSchema,
  type ListMailboxThreadsResponse,
  type MailThread,
} from '../contracts/mailbox';

/** The backend gives Gmail 20 seconds to answer; wait a little longer than that. */
const MAILBOX_TIMEOUT_MS = 25_000;

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

/** The connected Gmail address, from the status the app shell already keeps fresh. */
export function useGmailAddress(): string | null {
  const { data } = useQuery({
    queryKey: ['gmailStatus'],
    queryFn: ({ signal }) => api.getGmailStatus({ signal }),
  });
  return data?.gmailEmail ?? null;
}
