import {
  createRootRouteWithContext,
  Link,
  Outlet,
  redirect,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import { User, logout } from '../api/auth';
import { Sidebar } from '../components/layout/Sidebar';
import { MobileNav } from '../components/layout/MobileNav';
import { Logout, Portfolio, User as UserIcon } from '@carbon/icons-react';
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
  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans">
      <ProcessingRefreshObserver />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <DevModeBanner />
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Portfolio size={20} className="text-primary" aria-hidden="true" />
            <div className="font-semibold text-lg tracking-tight">Career Companion</div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/account"
              className="p-2 text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              aria-label="Account"
            >
              <UserIcon size={20} aria-hidden="true" />
            </Link>
            <button
              onClick={handleLogout}
              className="text-status-error p-2 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-none"
              aria-label="Logout"
            >
              <Logout size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>

        <MobileNav />
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
