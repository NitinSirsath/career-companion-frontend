import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LoginPage } from '../components/auth/LoginPage';
import { safeNextPath } from '../lib/signIn';

const loginSearchSchema = z.object({
  error: z.string().optional(),
  /** The page to open after sign-in. */
  next: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  component: Login,
  validateSearch: (search) => loginSearchSchema.parse(search),
});

function Login() {
  const { error, next } = Route.useSearch();
  return <LoginPage error={error} next={safeNextPath(next)} />;
}
