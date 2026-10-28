import { createFileRoute, redirect } from '@tanstack/react-router';

/** The Dashboard is the home page (owner, 27 Oct 2026). */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' });
  },
});
