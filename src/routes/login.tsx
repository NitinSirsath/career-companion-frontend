import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LoginPage } from '../components/auth/LoginPage';

const loginSearchSchema = z.object({
  error: z.string().optional(),
});

export const Route = createFileRoute('/login')({
  component: Login,
  validateSearch: (search) => loginSearchSchema.parse(search),
});

function Login() {
  const { error } = Route.useSearch();
  return <LoginPage error={error} />;
}
