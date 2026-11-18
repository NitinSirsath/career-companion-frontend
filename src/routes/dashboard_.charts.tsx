import { createFileRoute } from '@tanstack/react-router';
import { ChartsPage } from '../components/dashboard/ChartsPage';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { dashboardSearchSchema } from '../lib/dashboard';

export const Route = createFileRoute('/dashboard_/charts')({
  errorComponent: RouteErrorPage,
  validateSearch: dashboardSearchSchema,
  component: ChartsPage,
});
