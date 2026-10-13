import { createFileRoute } from '@tanstack/react-router';
import { ComingSoon } from '../components/ComingSoon';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';

export const Route = createFileRoute('/dashboard')({
  errorComponent: RouteErrorPage,
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <ComingSoon title="Dashboard" heading="Your job search in numbers">
      This page will show analytics about your applications. Until then, everything you need is on
      the Mails page.
    </ComingSoon>
  );
}
