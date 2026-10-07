// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows NotFoundPage for an unknown path', async () => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    });

    const knownRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/known',
      component: () => <div>Known page</div>,
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren([knownRoute]),
      history: createMemoryHistory({ initialEntries: ['/unknown'] }),
      defaultNotFoundComponent: NotFoundPage,
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText(/does not exist or is no longer available/)).toBeInTheDocument();
  });
});
