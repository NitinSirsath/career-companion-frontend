import { useQuery } from '@tanstack/react-query';
import { AppModeResponseSchema, type AppMode } from '../contracts/appMode';

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

/** True in dev mode: manual testing with made-up mail, where the mail sandbox stands in for Gmail. */
export function useDevMode(): boolean {
  const { data } = useQuery({
    queryKey: appModeKey,
    queryFn: getAppMode,
    staleTime: Infinity,
    retry: false,
  });
  return data === 'dev';
}
