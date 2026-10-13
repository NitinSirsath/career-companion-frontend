import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { AISettingsResponse } from '../../contracts/ai';
import {
  PAUSE_END_MARGIN_MS,
  WAITING_TRY_WINDOW_MS,
  waitingNotice,
  waitingPause,
  type WaitingTry,
} from '../../lib/aiWaiting';
import { startProcessingRefresh } from '../../lib/processingRefresh';

/**
 * The AI notice and its "Read waiting mails now" button. A try starts with the user's click or
 * when a pause ends (the backend then reads the waiting mail by itself); either way the page
 * keeps itself fresh until the answer shows.
 */
export function useWaitingNotice(settings: AISettingsResponse | undefined) {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<WaitingTry | null>(null);
  const reason = settings ? waitingPause(settings) : null;
  const pausedUntil = reason && settings ? settings.access.resumesAt : null;

  const read = useMutation({
    mutationFn: () => api.readWaitingMail(),
    retry: false,
    onSuccess: (next) => {
      if (reason)
        setAttempt({
          byUser: true,
          startedAt: new Date().toISOString(),
          reason,
          pausedUntil,
          expired: false,
        });
      queryClient.setQueryData(['aiSettings'], next);
      startProcessingRefresh();
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }),
  });

  // The pause ends by itself: look again just after, when the backend has offered the mail.
  useEffect(() => {
    if (!reason || !pausedUntil) return;
    const wait = Date.parse(pausedUntil) + PAUSE_END_MARGIN_MS - Date.now();
    const timer = setTimeout(
      () => {
        setAttempt({
          byUser: false,
          startedAt: new Date().toISOString(),
          reason,
          pausedUntil,
          expired: false,
        });
        startProcessingRefresh();
      },
      Math.max(wait, 0),
    );
    return () => clearTimeout(timer);
  }, [reason, pausedUntil]);

  // All waiting mail was read: the try is over, and a later pause is a new story.
  if (attempt && settings?.access.state === 'READY' && settings.waitingEmails === 0)
    setAttempt(null);

  const startedAt = attempt?.startedAt;
  useEffect(() => {
    if (!startedAt) return;
    const timer = setTimeout(
      () => setAttempt((current) => current && { ...current, expired: true }),
      WAITING_TRY_WINDOW_MS,
    );
    return () => clearTimeout(timer);
  }, [startedAt]);

  const shown = settings ? waitingNotice(settings, attempt) : null;
  const notice =
    shown && read.isPending && shown.button === 'ready'
      ? { ...shown, button: 'trying' as const }
      : shown;
  return { notice, read: () => read.mutate(), failed: read.isError };
}
