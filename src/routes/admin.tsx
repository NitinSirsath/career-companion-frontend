import { createFileRoute, notFound } from '@tanstack/react-router';
import { AdminPage } from '../components/admin/AdminPage';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';

/** Only for the emails in ADMIN_EMAILS; anyone else sees "Page not found", as the server says. */
export const Route = createFileRoute('/admin')({
  beforeLoad: ({ context }) => {
    if (!context.user?.admin) throw notFound();
  },
  errorComponent: RouteErrorPage,
  component: AdminPage,
});
