import { createFileRoute, redirect } from '@tanstack/react-router';

/**
 * The Dashboard is the app's home page (owner, 27 Oct 2026). The product page is its own site on
 * northlist.site, outside the app (owner, 31 Oct 2026).
 */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
});
