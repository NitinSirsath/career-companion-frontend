import { createFileRoute } from '@tanstack/react-router';
import { TestLoginPage } from '../components/auth/TestLoginPage';

export const Route = createFileRoute('/test-login')({
  component: TestLoginPage,
});
