import { createFileRoute, notFound } from '@tanstack/react-router';
import { PhoneAccountRoute } from '../components/admin/PhoneAccountPage';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';

/** One account, on phones (Admin › Accounts); laptops show every account in the Admin table. */
export const Route = createFileRoute('/admin_/accounts/$accountId')({
  beforeLoad: ({ context }) => {
    if (!context.user?.admin) throw notFound();
  },
  errorComponent: RouteErrorPage,
  component: PhoneAccountRoute,
});
