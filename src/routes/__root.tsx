import {
  createRootRouteWithContext,
  Outlet,
  redirect,
  useRouterState,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import type { User } from '../api/auth';
import { Sidebar } from '../components/layout/Sidebar';
import { MobileNav } from '../components/layout/MobileNav';
import { Portfolio } from '@carbon/icons-react';
import { ProcessingRefreshObserver } from '../components/ProcessingRefreshObserver';
import { DevErrorTrigger } from '../components/errors/DevErrorTrigger';
import { NotFoundPage } from '../components/errors/NotFoundPage';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { DevModeBanner } from '../components/devMode/DevModeBanner';

interface RouterContext {
  user: User | null;
}

interface LoggedInShellProps {
  children: React.ReactNode;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location, context }) => {
    if (!context.user && location.pathname !== '/login') {
      throw redirect({ to: '/login' });
    }
    if (context.user && location.pathname === '/login') {
      throw redirect({ to: '/' });
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
  const { user } = Route.useRouteContext();
  // The first part of the path: a new section fades in, while a list and its detail pages (one
  // route tree that keeps the list's filters) stay mounted.
  const section = useRouterState({
    select: (state) => state.location.pathname.split('/')[1] ?? '',
  });
  return (
    <div className="flex min-h-screen bg-background font-sans text-text-primary">
      <ProcessingRefreshObserver />
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <DevModeBanner />
        <header className="flex h-12 items-center gap-3 border-b border-border-subtle bg-surface px-4 md:hidden">
          <Portfolio size={16} className="text-link" aria-hidden="true" />
          <span className="font-semibold">Career Companion</span>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {/* One width for every page: the full width up to 1584px, centred beyond. */}
          <div key={section} className="mx-auto w-full max-w-[1584px] animate-page-in">
            {children}
          </div>
        </main>

        <MobileNav user={user} />
      </div>
    </div>
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
