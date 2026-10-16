import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { AISettingsResponse } from '../../contracts/ai';
import {
  PAUSE_END_MARGIN_MS,
  runningTest,
  tryAnswered,
  waitingNotice,
  waitingTitle,
  type WaitingNotice,
  type WaitingTry,
} from '../../lib/aiWaiting';
import {
  PROCESSING_REFRESH_INTERVAL_MS,
  getProcessingRefreshUntil,
  startProcessingRefresh,
} from '../../lib/processingRefresh';

/** The button's own try sends 1 test mail first; a try after a pause ended by itself does not. */
const sendsTestMail = (settings: AISettingsResponse | undefined, shown: WaitingNotice | null) =>
  shown?.button === 'ready' || (!!settings && !!runningTest(settings));

/**
 * The AI notice and its "Read waiting mails now" button. A try starts with the user's click or
 * when a pause ends (the backend then reads the waiting mail by itself); either way the page
 * keeps itself fresh, and the notice says so, until the answer shows.
 */
export function useWaitingNotice(settings: AISettingsResponse | undefined) {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<WaitingTry | null>(null);
  const title = settings ? waitingTitle(settings) : null;
  const pausedUntil = title && settings ? settings.access.resumesAt : null;

  const read = useMutation({
    mutationFn: () => api.readWaitingMail(),
    retry: false,
    onSuccess: (next) => {
      if (title) setAttempt({ title, pausedUntil });
      queryClient.setQueryData(['aiSettings'], next);
      startProcessingRefresh();
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }),
  });

  // The pause ends by itself: look again just after, when the backend has offered the mail.
  useEffect(() => {
    if (!title || !pausedUntil) return;
    const wait = Date.parse(pausedUntil) + PAUSE_END_MARGIN_MS - Date.now();
    const timer = setTimeout(
      () => {
        setAttempt({ title, pausedUntil });
        startProcessingRefresh();
      },
      Math.max(wait, 0),
    );
    return () => clearTimeout(timer);
  }, [title, pausedUntil]);

  // The answer came: the try is over, and a later pause is a new story.
  if (attempt && settings && tryAnswered(settings, attempt)) setAttempt(null);

  const shown = settings ? waitingNotice(settings, attempt) : null;

  // Reading many waiting mails can take longer than one refresh window. While the notice says it
  // is trying, an ended window opens once more, and once more again after each change in the
  // waiting count, so the answer shows; a try that reads no mail for a whole window stops there,
  // and the notice shows the server's state again.
  const trying = shown?.button === 'trying';
  const waiting = settings?.waitingEmails;
  useEffect(() => {
    if (!trying) return;
    let reopened = false;
    const timer = setInterval(() => {
      if (getProcessingRefreshUntil() > Date.now()) return;
      if (reopened) {
        setAttempt(null);
        return;
      }
      reopened = true;
      startProcessingRefresh();
    }, PROCESSING_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [trying, waiting]);

  const notice =
    shown && read.isPending && shown.button === 'ready'
      ? { ...shown, button: 'trying' as const }
      : shown;
  return {
    notice,
    read: () => read.mutate(),
    failed: read.isError,
    sendsTest: sendsTestMail(settings, shown),
  };
}
