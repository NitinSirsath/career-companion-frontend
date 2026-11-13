import { createFileRoute } from '@tanstack/react-router';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { AppearancePage } from '../components/phone/AppearancePage';

export const Route = createFileRoute('/settings/appearance')({
  errorComponent: RouteErrorPage,
  component: AppearancePage,
});
