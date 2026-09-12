import { api } from './client';

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    // using raw fetch directly to bypass throwing error on 401
    const response = await fetch('/api/auth/me', { credentials: 'include' });
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
