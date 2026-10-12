import { createFileRoute, redirect } from '@tanstack/react-router';

/** Mails is the home page. */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/mails' });
  },
});
