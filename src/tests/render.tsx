import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

/**
 * Renders one part on its own, inside a router and a query client. For parts that are kept in
 * the repo but shown on no page: the old dashboard's task list.
 */
export function renderPart(part: ReactNode, queryClient: QueryClient) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => part }),
    history: createMemoryHistory(),
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
