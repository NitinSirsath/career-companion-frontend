import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';
import { ThemeProvider } from './components/ThemeProvider';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { RouteErrorPage } from './components/errors/RouteErrorPage';
import { NotFoundPage } from './components/errors/NotFoundPage';
import { ToastProvider } from './components/ui/toast';
import { SignInGate } from './components/startup/SignInGate';
import { fetchLiveVersion, startQuietUpdates } from './lib/quietUpdate';

const queryClient = new QueryClient();

// Create router outside the component tree
const router = createRouter({
  routeTree,
  context: { user: null },
  defaultErrorComponent: RouteErrorPage,
  defaultNotFoundComponent: NotFoundPage,
});

// A new version is taken by itself at a safe moment (owner, 26 Oct 2026); not in local dev mode.
if (import.meta.env.PROD)
  startQuietUpdates({
    current: __APP_VERSION__,
    liveVersion: fetchLiveVersion,
    onNavigate: (listener) => router.subscribe('onBeforeNavigate', listener),
    load: (href) => (href ? window.location.assign(href) : window.location.reload()),
  });

/** The app opens only once it knows who is signed in; until then the start-up screen shows. */
function App() {
  return <SignInGate>{(user) => <RouterProvider router={router} context={{ user }} />}</SignInGate>;
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
