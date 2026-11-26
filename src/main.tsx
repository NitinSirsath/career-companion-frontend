import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { LucideProvider } from 'lucide-react';
import { routeTree } from './routeTree.gen';
import { ThemeProvider } from './components/ThemeProvider';
import { THEME_STORAGE_KEY } from './lib/theme';
import { AppErrorBoundary } from './components/errors/AppErrorBoundary';
import { RouteErrorPage } from './components/errors/RouteErrorPage';
import { NotFoundPage } from './components/errors/NotFoundPage';
import { ToastProvider } from './components/ui/toast';
import { SignInGate } from './components/startup/SignInGate';
import { SuspendedPage } from './components/admin/SuspendedPage';
import { fetchLiveVersion, reloadInPlace, startQuietUpdates } from './lib/quietUpdate';
import { appVersion } from './lib/appVersion';
import { watchMissingParts } from './lib/missingPart';
import { isInstalledApp } from './lib/alerts';
import { createQueryClient } from './components/queryClient';
import { startFromBrowserOnlineState } from './lib/offline';
import { startServiceWorker } from './lib/serviceWorker';
import { startInstallWatch } from './lib/install';
import { watchSystemBack } from './lib/systemBack';

startFromBrowserOnlineState();
// Keeps the browser's install offer for the "Install NorthList" card (owner, 18 Nov 2026).
startInstallWatch();
const queryClient = createQueryClient();
// Notes when the browser drew a step back itself. Before the router is made: it has to hear of
// the step first.
watchSystemBack();

// Create router outside the component tree
const router = createRouter({
  routeTree,
  context: { user: null },
  defaultErrorComponent: RouteErrorPage,
  defaultNotFoundComponent: NotFoundPage,
});

// A new version is taken by itself at a safe moment (owner, 26 Oct 2026); not in local dev mode.
// The installed app is never reloaded while it is in use.
if (import.meta.env.PROD)
  startQuietUpdates({
    current: appVersion(),
    liveVersion: fetchLiveVersion,
    onNavigate: (listener) => router.subscribe('onBeforeNavigate', listener),
    load: reloadInPlace,
    installed: isInstalledApp({ navigator, window }),
  });

// A part that loads later (the reply box) and is gone from the server: load the page again, once.
if (import.meta.env.PROD)
  watchMissingParts({ current: appVersion(), load: () => reloadInPlace(null) });

// Keeps the app's files for offline pages and shows push alerts (owner, 30 Oct 2026).
if (import.meta.env.PROD) startServiceWorker();

/**
 * The app opens only once it knows who is signed in; until then the start-up screen shows. A
 * suspended account sees only the suspended page (owner, 18 Nov 2026).
 */
function App() {
  return (
    <SignInGate>
      {(user) =>
        user?.suspension ? (
          <SuspendedPage suspension={user.suspension} />
        ) : (
          <RouterProvider router={router} context={{ user }} />
        )
      }
    </SignInGate>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Lucide icons with thin lines (owner, 13 Nov 2026), 16px unless a size is given. */}
    <LucideProvider size={16} strokeWidth={1.75}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider storageKey={THEME_STORAGE_KEY}>
          <ToastProvider>
            <AppErrorBoundary>
              <App />
            </AppErrorBoundary>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </LucideProvider>
  </StrictMode>,
);
