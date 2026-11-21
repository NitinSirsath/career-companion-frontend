import { createFileRoute, redirect } from '@tanstack/react-router';
import { dashboardSearchSchema } from '../lib/dashboard';

/**
 * The old "Charts and rates" page (18 Nov 2026). Today shows the charts itself since 21 Nov 2026,
 * so saved links and installed apps land there, with the period kept.
 */
export const Route = createFileRoute('/dashboard_/charts')({
  validateSearch: dashboardSearchSchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/dashboard', search, replace: true });
  },
});
