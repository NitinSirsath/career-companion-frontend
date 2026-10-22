import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { TestLoginRoute } from '../components/auth/TestLoginPage';

const testLoginSearchSchema = z.object({
  /** The page to open after sign-in. */
  next: z.string().optional(),
});

export const Route = createFileRoute('/test-login')({
  component: TestLoginRoute,
  validateSearch: (search) => testLoginSearchSchema.parse(search),
});
