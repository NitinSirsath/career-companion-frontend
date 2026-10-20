import { useQuery } from '@tanstack/react-query';
import { AppModeResponseSchema, type AppMode } from '../contracts/appMode';
import { getCurrentUser } from './auth';

export const appModeKey = ['appMode'] as const;

/**
 * The mode the backend runs in. The frontend has no mode setting of its own. Never throws:
 * anything but a valid answer means prod. Plain fetch, so it also works before sign-in.
 */
export async function getAppMode(): Promise<AppMode> {
  try {
    const response = await fetch('/api/app-mode', { cache: 'no-store' });
    if (!response.ok) return 'prod';
    const parsed = AppModeResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.mode : 'prod';
  } catch {
    return 'prod';
  }
}

/** The backend's mode; undefined until it has answered. */
export function useAppMode(): AppMode | undefined {
  const { data } = useQuery({
    queryKey: appModeKey,
    queryFn: getAppMode,
    staleTime: Infinity,
    retry: false,
  });
  return data;
}

/** True in dev mode: manual testing with made-up mail, where the mail sandbox stands in for Gmail. */
export const useDevMode = (): boolean => useAppMode() === 'dev';

export const currentUserKey = ['auth', 'currentUser'] as const;

/**
 * True for a signed-in test account, false otherwise; undefined until the backend has answered.
 * Plain fetch, so a signed-out page is not sent to the login page.
 */
export function useTestAccount(): boolean | undefined {
  const { data, isPending } = useQuery({
    queryKey: currentUserKey,
    queryFn: getCurrentUser,
    staleTime: Infinity,
    retry: false,
  });
  return isPending ? undefined : data?.testAccount === true;
}

/** True when the user's mailbox is the mail sandbox: in dev mode, or for a test account. */
export function useSandboxMailbox(): boolean {
  const devMode = useDevMode();
  const testAccount = useTestAccount();
  return devMode || testAccount === true;
}
