import { createFileRoute, notFound } from '@tanstack/react-router';
import { AdminMoneyRoute } from '../components/admin/AdminMoneyPage';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';

/** Admin › Free AI money, on phones; laptops show it on the Admin page itself. */
export const Route = createFileRoute('/admin_/money')({
  beforeLoad: ({ context }) => {
    if (!context.user?.admin) throw notFound();
  },
  errorComponent: RouteErrorPage,
  component: AdminMoneyRoute,
});
