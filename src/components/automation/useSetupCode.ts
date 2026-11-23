import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import { SETUP_CODE_MINUTES } from '../../contracts/integrationToken';
import type { AIAppKey } from '../../lib/onboarding';
import { copyText } from '../../lib/clipboard';
import { codeSetupPrompt, openAppLink } from '../../lib/setupPrompt';
import { useServerAddress } from './useServerAddress';

/** How often the page asks whether the AI app has connected. */
const CONNECTED_POLL_MS = 3000;

export type SetupCode = { code: string; prompt: string; expiresAt: number };

/** Why the setup code could not be made, in the user's words. */
function codeProblem(error: unknown): string {
  if (isApiError(error) && !error.outcomeUncertain) return error.message;
  return 'Making the setup code failed. Try again.';
}

/** Seconds until `expiresAt`, ticking once a second while there is time left. */
function useSecondsLeft(expiresAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (expiresAt === null) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  if (expiresAt === null) return 0;
  // Until the first tick, `now` may be from before the code: never more than the code's minutes.
  return Math.min(SETUP_CODE_MINUTES * 60, Math.max(0, Math.ceil((expiresAt - now) / 1000)));
}

/**
 * True once the AI app swapped the code for a token and used it: a token that was not there when
 * the code was made has a first use. Asks until then.
 */
function useConnected(known: Set<string> | null) {
  const { data } = useQuery({
    queryKey: ['integrationTokens', 'connected', known ? [...known].join() : null],
    queryFn: async ({ signal }) => {
      const list = await api.listIntegrationTokens({ limit: 20 }, { signal });
      return list.items.some((t) => !known?.has(t.id) && t.lastUsedAt !== null);
    },
    enabled: known !== null,
    refetchInterval: (query) => (query.state.data ? false : CONNECTED_POLL_MS),
  });
  return data === true;
}

/**
 * One-click setup of NorthList Apply (owner, 23 Nov 2026): a setup code that works once, for 10
 * minutes, in a prompt that opens the AI app (Codex, Claude Code) or is copied (Antigravity). The
 * code lives only in this hook's state, never in a cache, the address or browser storage.
 */
/**
 * Makes a setup code, or gives the live one again; remembers the tokens there were before, so the
 * new token the AI app makes can be told apart.
 */
function useMakeCode() {
  const serverAddress = useServerAddress();
  const [made, setMade] = useState<SetupCode | null>(null);
  const [known, setKnown] = useState<Set<string> | null>(null);
  const making = useRef<Promise<SetupCode> | null>(null);
  const make = (appName: string, reuse: SetupCode | null): Promise<SetupCode> => {
    if (reuse) return Promise.resolve(reuse);
    if (making.current) return making.current;
    const address = serverAddress as string;
    const run = (async () => {
      const before = await api.listIntegrationTokens({ limit: 20 });
      const result = await api.createSetupCode({ name: appName });
      const code = {
        code: result.code,
        prompt: codeSetupPrompt(address, result.code),
        expiresAt: Date.parse(result.expiresAt),
      };
      setKnown(new Set(before.items.map((t) => t.id)));
      setMade(code);
      return code;
    })();
    making.current = run;
    run.finally(() => (making.current = null)).catch(() => undefined);
    return run;
  };
  return { serverAddress, made, known, make };
}

/** Copies the prompt; says whether it worked. The code may still be on its way. */
async function copyPrompt(code: Promise<SetupCode>): Promise<'yes' | 'failed'> {
  try {
    await copyText(code.then((c) => c.prompt));
    return 'yes';
  } catch {
    await code;
    return 'failed';
  }
}

export function useSetupCode() {
  const queryClient = useQueryClient();
  const { serverAddress, made, known, make } = useMakeCode();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const secondsLeft = useSecondsLeft(made?.expiresAt ?? null);
  const connected = useConnected(known);
  const live = made !== null && secondsLeft > 0;

  useEffect(() => {
    if (connected) void queryClient.invalidateQueries({ queryKey: ['integrationTokens'] });
  }, [connected, queryClient]);

  /** Opens the AI app with the prompt typed in, or copies the prompt when the app has no link. */
  const start = async (app: { key: AIAppKey; name: string }, fresh = false) => {
    if (!serverAddress || pending) return;
    setPending(true);
    setProblem(null);
    setCopied(null);
    const code = make(app.name, !fresh && live ? made : null);
    try {
      if (app.key === 'antigravity') setCopied(await copyPrompt(code));
      else {
        const link = openAppLink(app.key, (await code).prompt);
        if (link) window.location.assign(link);
      }
    } catch (error) {
      setProblem(codeProblem(error));
    } finally {
      setPending(false);
    }
  };

  /** Copies the prompt of the code already made (the "Copy prompt instead" button). */
  const copy = async () => {
    if (made) setCopied(await copyPrompt(Promise.resolve(made)));
  };

  return {
    made: live ? made : null,
    expired: made !== null && secondsLeft === 0,
    secondsLeft,
    pending,
    problem,
    copied,
    connected,
    ready: serverAddress !== null,
    start,
    copy,
  };
}
