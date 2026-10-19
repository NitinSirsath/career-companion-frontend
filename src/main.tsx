import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';
import { getCurrentUser } from './api/auth';
import { ThemeProvider } from './components/ThemeProvider';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { RouteErrorPage } from './components/errors/RouteErrorPage';
import { NotFoundPage } from './components/errors/NotFoundPage';
import { ToastProvider } from './components/ui/toast';
import { AppSkeleton } from './components/layout/AppSkeleton';

const queryClient = new QueryClient();

// Create router outside the component tree
const router = createRouter({
  routeTree,
  context: { user: null },
  defaultErrorComponent: RouteErrorPage,
  defaultNotFoundComponent: NotFoundPage,
});

function App() {
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <AppSkeleton />;

  // Pass the dynamic context to the router provider
  return <RouterProvider router={router} context={{ user }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider storageKey="career-companion-theme">
        <ToastProvider>
          <AppErrorBoundary>
            <App />
          </AppErrorBoundary>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
