import { createRootRouteWithContext, Outlet, redirect } from '@tanstack/react-router';
import { User, logout } from '../api/auth';
import { Sidebar } from '../components/layout/Sidebar';
import { MobileNav } from '../components/layout/MobileNav';
import { Briefcase, LogOut } from 'lucide-react';

interface RouterContext {
  user: User | null;
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
  component: RootComponent,
});

function RootComponent() {
  const context = Route.useRouteContext();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  // If not logged in (e.g. login page), just render Outlet without shell
  if (!context.user) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-lg tracking-tight">Career Companion</h1>
          </div>
          <button onClick={handleLogout} className="text-destructive p-2" aria-label="Logout">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
        
        <MobileNav />
      </div>
    </div>
  );
}
