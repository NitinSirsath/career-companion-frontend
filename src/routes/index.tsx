import { createFileRoute, redirect } from '@tanstack/react-router';
import { ProductPage } from '../components/product/ProductPage';

/**
 * Signed in: the Dashboard is the home page (owner, 27 Oct 2026). Not signed in: the public
 * product page (owner, 31 Oct 2026).
 */
export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.user) throw redirect({ to: '/dashboard' });
  },
  component: ProductPage,
});
