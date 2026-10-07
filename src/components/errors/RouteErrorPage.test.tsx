// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { RouteErrorPage } from './RouteErrorPage';

describe('RouteErrorPage', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('keeps the layout visible and retries a render error after it stops throwing', async () => {
    vi.stubEnv('DEV', false);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;

    const rootRoute = createRootRoute({
      component: () => (
        <div>
          <nav aria-label="Test navigation">Navigation</nav>
          <Outlet />
        </div>
      ),
    });

    const childRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      errorComponent: RouteErrorPage,
      component: () => {
        if (shouldThrow) {
          throw new Error('render failure');
        }

        return <div>Recovered page</div>;
      },
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren([childRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      defaultErrorComponent: RouteErrorPage,
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('navigation', { name: 'Test navigation' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.queryByText('render failure')).not.toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('Recovered page')).toBeInTheDocument();
    });
  });

  it('shows RouteErrorPage when a route loader throws', async () => {
    vi.stubEnv('DEV', false);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    });

    const loaderRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/loader-failure',
      loader: () => {
        throw new Error('loader failure');
      },
      errorComponent: RouteErrorPage,
      component: () => <div>Should not render</div>,
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren([loaderRoute]),
      history: createMemoryHistory({ initialEntries: ['/loader-failure'] }),
      defaultErrorComponent: RouteErrorPage,
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.queryByText('loader failure')).not.toBeInTheDocument();
  });
});
