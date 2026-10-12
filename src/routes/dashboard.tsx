import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

export const Route = createFileRoute('/dashboard')({
  errorComponent: RouteErrorPage,
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <section className="flex min-h-96 flex-col items-center justify-center gap-3 border border-border-default bg-surface-subtle px-6 py-12 text-center">
        <Badge variant="secondary">Coming soon</Badge>
        <h2 className="text-xl font-semibold">Your job search in numbers</h2>
        <p className="max-w-lg text-sm text-text-secondary">
          This page will show analytics about your applications. Until then, everything you need is
          on the Mails page.
        </p>
        <Button className="mt-2" onClick={() => void navigate({ to: '/mails' })}>
          Open Mails
        </Button>
      </section>
    </div>
  );
}
