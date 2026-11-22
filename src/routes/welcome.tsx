import { createFileRoute, redirect } from '@tanstack/react-router';
import { Onboarding } from '../components/onboarding/Onboarding';
import { ProcessingRefreshObserver } from '../components/ProcessingRefreshObserver';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { onboardingOpen } from '../lib/onboarding';

/** The first run (owner, 22 Nov 2026), full screen. Once it is done the address opens the Dashboard. */
export const Route = createFileRoute('/welcome')({
  beforeLoad: ({ context }) => {
    if (!onboardingOpen(context.user)) throw redirect({ to: '/dashboard' });
  },
  errorComponent: RouteErrorPage,
  component: WelcomePage,
});

function WelcomePage() {
  const { user } = Route.useRouteContext();
  if (!user) return null;
  return (
    <>
      {/* The first sync and the reading start here: the lists refresh as they end. */}
      <ProcessingRefreshObserver />
      <Onboarding user={user} />
    </>
  );
}
