import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TRY_TIMEOUT_MS } from '../lib/startup';
import { api } from './client';
import {
  UserProfileSchema,
  type OnboardingStep,
  type PasswordLoginRequest,
  type RegisterRequest,
  type SetPasswordRequest,
  type UserProfile,
} from '../contracts/auth';

export interface User {
  id: string;
  email: string;
  name: string | null;
  testAccount?: boolean;
  /** In ADMIN_EMAILS: the menu shows the Admin page. */
  admin?: boolean;
  /** Set while the owner has suspended the account: the app shows only the suspended page. */
  suspension?: UserProfile['suspension'];
  /** While the first run is open: the step to continue at. Null once it is done. */
  onboarding?: UserProfile['onboarding'];
}

export const authKeys = { profile: ['auth', 'profile'] as const };

export type SignInAnswer =
  | { kind: 'signed-in'; user: User }
  | { kind: 'signed-out' }
  /** No answer in time, a network error or a 5xx, as while the free server wakes up. */
  | { kind: 'no-answer' };

/**
 * Asks the server who is signed in. Only a 401 means signed out: a server that does not answer
 * never sends a signed-in user to the sign-in page. Plain fetch, so a 401 sends nobody anywhere.
 */
export async function checkSignIn(signal?: AbortSignal): Promise<SignInAnswer> {
  const controller = new AbortController();
  const stop = () => controller.abort();
  const timer = setTimeout(stop, TRY_TIMEOUT_MS);
  signal?.addEventListener('abort', stop);
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 401) return { kind: 'signed-out' };
    if (!response.ok) return { kind: 'no-answer' };
    return { kind: 'signed-in', user: (await response.json()) as User };
  } catch {
    return { kind: 'no-answer' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

/** The signed-in user, or null when signed out or when the server gave no answer. */
export async function getCurrentUser(): Promise<User | null> {
  const answer = await checkSignIn();
  return answer.kind === 'signed-in' ? answer.user : null;
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
}

/** The signed-in user's account, with the ways they can sign in. */
export async function getProfile(signal?: AbortSignal): Promise<UserProfile> {
  return UserProfileSchema.parse(await api.get<unknown>('/api/auth/me', { signal }));
}

export async function loginWithPassword(input: PasswordLoginRequest): Promise<UserProfile> {
  return UserProfileSchema.parse(await api.post<unknown>('/api/auth/login', input));
}

/** The test sign-in: test accounts only, which use the mail sandbox instead of Gmail. */
export async function loginToTestAccount(input: PasswordLoginRequest): Promise<UserProfile> {
  return UserProfileSchema.parse(await api.post<unknown>('/api/auth/test-login', input));
}

/** Dev mode only: the backend answers 404 in prod mode. */
export async function registerTestUser(input: RegisterRequest): Promise<UserProfile> {
  return UserProfileSchema.parse(await api.post<unknown>('/api/auth/register', input));
}

export async function setPassword(input: SetPasswordRequest): Promise<UserProfile> {
  return UserProfileSchema.parse(await api.post<unknown>('/api/auth/password', input));
}

export function useProfile() {
  return useQuery({
    queryKey: authKeys.profile,
    queryFn: ({ signal }) => getProfile(signal),
  });
}

/** A suspended user asks the owner to resume the account; the answer is the new profile. */
export async function sendResumeRequest(text: string): Promise<UserProfile> {
  return UserProfileSchema.parse(await api.post<unknown>('/api/auth/resume-request', { text }));
}

/** The normal sign-in, or the test sign-in when `testAccount` is set. */
export const usePasswordLogin = (testAccount = false) =>
  useMutation({ mutationFn: testAccount ? loginToTestAccount : loginWithPassword });

export const useRegisterTestUser = () => useMutation({ mutationFn: registerTestUser });

/** Sets or changes the password; the answer is the new profile, so the page shows it at once. */
export function useSetPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setPassword,
    onSuccess: (profile) => queryClient.setQueryData(authKeys.profile, profile),
  });
}

/** The first-run step the user reached, so leaving halfway continues there. */
export async function saveOnboardingStep(step: OnboardingStep): Promise<UserProfile> {
  return UserProfileSchema.parse(await api.post<unknown>('/api/auth/onboarding', { step }));
}

/** Ends the first run for good, finished or skipped. */
export async function finishOnboarding(): Promise<UserProfile> {
  return UserProfileSchema.parse(await api.post<unknown>('/api/auth/onboarding/finish'));
}
