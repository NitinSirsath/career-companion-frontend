import { useCallback, useEffect, useState } from 'react';
import { checkSignIn, type User } from '../../api/auth';
import {
  GIVE_UP_AFTER_MS,
  RETRY_EVERY_MS,
  startupStage,
  type StartupStage,
} from '../../lib/startup';

export type SignInCheck =
  | { known: true; user: User | null }
  | { known: false; stage: StartupStage; waitedMs: number; retry: () => void };

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * Finds out who is signed in before the app shows anything. While the server does not answer,
 * it tries again every few seconds, and stops after two minutes until the user asks again.
 */
export function useSignInCheck(): SignInCheck {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  // Counts "Try again", so a new round of tries starts even within the same millisecond.
  const [round, setRound] = useState(0);
  const [online, setOnline] = useState(isOnline);
  const known = user !== undefined;

  const retry = useCallback(() => {
    const time = Date.now();
    setStartedAt(time);
    setNow(time);
    setRound((count) => count + 1);
  }, []);

  // The tries: one now, then again after each "no answer", until the time is up.
  useEffect(() => {
    if (known) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = async () => {
      const answer = await checkSignIn(controller.signal);
      if (controller.signal.aborted) return;
      if (answer.kind === 'signed-in') setUser(answer.user);
      else if (answer.kind === 'signed-out') setUser(null);
      else if (Date.now() - startedAt < GIVE_UP_AFTER_MS)
        timer = setTimeout(() => void attempt(), RETRY_EVERY_MS);
    };
    void attempt();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [known, startedAt, round]);

  // The clock for "Waiting 0:12".
  useEffect(() => {
    if (known) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [known]);

  // Back online: try again at once.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      retry();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [retry]);

  if (known) return { known, user };
  const waitedMs = now - startedAt;
  return { known, stage: startupStage(waitedMs, online), waitedMs, retry };
}
