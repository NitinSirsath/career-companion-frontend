// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    vi.restoreAllMocks();
  });

  it('keeps the layout visible and retries a render error after it stops throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;

    const rootRoute = createRootRoute({
      component: () => <Outlet />,
      errorComponent: (props) => (
        <div>
          <nav aria-label="Test navigation">Navigation</nav>
          <RouteErrorPage {...props} />
        </div>
      ),
    });

    const childRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
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
});
