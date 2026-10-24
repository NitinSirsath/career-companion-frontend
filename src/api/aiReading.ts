import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export const aiReadingKey = ['aiReading'] as const;

/** While mails are read, the status asks every 5 seconds; otherwise only when something changed. */
export const READING_POLL_MS = 5_000;
/** The reader starts again just after a pause ends; the status asks a moment after that. */
const RESUME_MARGIN_MS = 5_000;
/** The longest wait a browser timer takes. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * "AI is reading your mails" (owner, 24 Oct 2026). It asks every 5 seconds while mails are read,
 * once when a pause or the daily limit ends, and when the window comes back into focus or a sync
 * ends (the processing refresh). Never on a timer while nothing waits.
 */
export function useAIReading() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: aiReadingKey,
    queryFn: ({ signal }) => api.getAIReading({ signal }),
    refetchInterval: (current) =>
      current.state.data?.state === 'READING' ? READING_POLL_MS : false,
  });
  const resumesAt = query.data?.resumesAt;
  useEffect(() => {
    if (!resumesAt) return;
    const wait = Date.parse(resumesAt) + RESUME_MARGIN_MS - Date.now();
    if (!(wait > 0)) return;
    const timer = setTimeout(
      () => void queryClient.invalidateQueries({ queryKey: aiReadingKey }),
      Math.min(wait, MAX_TIMER_MS),
    );
    return () => clearTimeout(timer);
  }, [resumesAt, queryClient]);
  return query;
}
