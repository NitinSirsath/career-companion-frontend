import { createFileRoute } from '@tanstack/react-router';
import { AccountPage } from '../components/auth/AccountPage';

export const Route = createFileRoute('/account')({
  component: AccountPage,
});
