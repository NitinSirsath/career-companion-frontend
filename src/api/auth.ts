import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import {
  UserProfileSchema,
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
}

export const authKeys = { profile: ['auth', 'profile'] as const };

export async function getCurrentUser(): Promise<User | null> {
  try {
    const headers: Record<string, string> = {};

    // using raw fetch directly to bypass throwing error on 401
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
      headers,
    });
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('Auth error');
    return response.json();
  } catch (err: any) {
    return null;
  }
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
