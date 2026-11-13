import {
  createRootRouteWithContext,
  Outlet,
  redirect,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import type { User } from '../api/auth';
import { safeNextPath, SIGN_IN_PAGES } from '../lib/signIn';
import { BreadcrumbProvider } from '../components/layout/Breadcrumb';
import { LaptopShell } from '../components/layout/LaptopShell';
import { OfflinePage } from '../components/layout/OfflinePage';
import { useIsPhone } from '../components/layout/useIsPhone';
import { PhoneShell } from '../components/phone/PhoneShell';
import { ProcessingRefreshObserver } from '../components/ProcessingRefreshObserver';
import { DevErrorTrigger } from '../components/errors/DevErrorTrigger';
import { NotFoundPage } from '../components/errors/NotFoundPage';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';

interface RouterContext {
  user: User | null;
}

interface LoggedInShellProps {
  children: React.ReactNode;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location, context }) => {
    const signInPage = SIGN_IN_PAGES.includes(location.pathname);
    if (!context.user && !signInPage) {
      // After sign-in the user comes back to the page asked for.
      throw redirect({
        to: '/login',
        search: location.href === '/' ? {} : { next: location.href },
      });
    }
    if (context.user && signInPage) {
      const next = safeNextPath((location.search as { next?: unknown }).next);
      // `href` keeps the page's own search, as the address had it.
      throw redirect({ to: '/', href: next ?? undefined });
    }
  },
  errorComponent: RootRouteError,
  notFoundComponent: NotFoundPage,
  component: RootComponent,
});

function RootRouteError(props: ErrorComponentProps) {
  const context = Route.useRouteContext();

  if (!context.user) {
    return <RouteErrorPage {...props} />;
  }

  return (
    <LoggedInShell>
      <RouteErrorPage {...props} />
    </LoggedInShell>
  );
}

function LoggedInShell({ children }: LoggedInShellProps) {
  const phone = useIsPhone();
  return (
    <BreadcrumbProvider>
      <ProcessingRefreshObserver />
      {phone ? (
        <PhoneShell>
          <OfflinePage>{children}</OfflinePage>
        </PhoneShell>
      ) : (
        <LaptopShell>{children}</LaptopShell>
      )}
    </BreadcrumbProvider>
  );
}

function RootComponent() {
  const context = Route.useRouteContext();

  if (!context.user) {
    return <Outlet />;
  }

  return (
    <LoggedInShell>
      <DevErrorTrigger />
      <Outlet />
    </LoggedInShell>
  );
}
