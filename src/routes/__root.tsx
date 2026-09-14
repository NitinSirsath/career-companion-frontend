import { createRootRouteWithContext, Outlet, Link, redirect } from '@tanstack/react-router';
import { User, logout } from '../api/auth';

interface RouterContext {
  user: User | null;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location, context }) => {
    // Only fetch user if not present, and let context handle it.
    // We will do actual fetch in main.tsx or app root to inject context.
    if (!context.user && location.pathname !== '/login') {
      console.log("redirecting to login"); throw redirect({
        to: '/login',
      });
    }
    if (context.user && location.pathname === '/login') {
      console.log("redirecting to login"); throw redirect({
        to: '/',
      });
    }
  },
  component: RootComponent,
});

function RootComponent() {
  const context = Route.useRouteContext();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login'; // hard reload to clear context
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <div className="p-4 border-b border-border flex justify-between items-center">
        <h1 className="font-semibold text-lg">Career Companion</h1>
        {context.user && (
          <div className="text-sm opacity-80 flex gap-6 items-center">
            <Link to="/" className="[&.active]:font-bold hover:underline">Home</Link>
            <Link to="/applications" className="[&.active]:font-bold hover:underline">Applications</Link>
            <Link to="/gmail" className="[&.active]:font-bold hover:underline">Gmail</Link>
            <button onClick={handleLogout} className="ml-4 hover:underline text-red-500 font-medium">Logout</button>
          </div>
        )}
      </div>
      <div className="flex-1 p-4">
        <Outlet />
      </div>
    </div>
  );
}
