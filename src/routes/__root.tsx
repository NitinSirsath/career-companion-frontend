import {
  createRootRouteWithContext,
  Outlet,
  redirect,
  useRouterState,
  type ErrorComponentProps,
} from '@tanstack/react-router';
import type { User } from '../api/auth';
import { BreadcrumbProvider } from '../components/layout/Breadcrumb';
import { Sidebar } from '../components/layout/Sidebar';
import { MobileNav } from '../components/layout/MobileNav';
import { TopBar } from '../components/layout/TopBar';
import { useMenuCollapsed } from '../components/layout/useMenuCollapsed';
import { ProcessingRefreshObserver } from '../components/ProcessingRefreshObserver';
import { DevErrorTrigger } from '../components/errors/DevErrorTrigger';
import { NotFoundPage } from '../components/errors/NotFoundPage';
import { RouteErrorPage } from '../components/errors/RouteErrorPage';

/** Pages for signed-out visitors: the sign-in, and the test account sign-in. */
const SIGN_IN_PAGES = ['/login', '/test-login'];

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
      throw redirect({ to: '/login' });
    }
    if (context.user && signInPage) {
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
  const [collapsed, setCollapsed] = useMenuCollapsed();
  // The first part of the path: a new section fades in, while a list and its detail pages (one
  // route tree that keeps the list's filters) stay mounted.
  const section = useRouterState({
    select: (state) => state.location.pathname.split('/')[1] ?? '',
  });
  return (
    <BreadcrumbProvider>
      <div className="flex min-h-screen flex-col bg-background font-sans text-text-primary">
        <ProcessingRefreshObserver />
        <TopBar user={user} collapsed={collapsed} />
        <div className="flex min-w-0 flex-1">
          <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} />
          <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
            <main className="flex-1 px-4 py-6 md:px-12 md:py-8">
              {/* One width for every page: the full width up to 1584px, centred beyond. */}
              <div key={section} className="mx-auto w-full max-w-[1584px] animate-page-in">
                {children}
              </div>
            </main>

            <MobileNav user={user} />
          </div>
        </div>
      </div>
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
