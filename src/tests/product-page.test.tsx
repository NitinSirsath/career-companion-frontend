// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn(), getGmailStatus: vi.fn(), getAISettings: vi.fn() },
}));

import { ApiError, api } from '../api/client';
import { routeTree } from '../routeTree.gen';

const ME = { id: 'u', email: 'u@test.local', name: 'U' };
const TITLE = 'Your job search, sorted from your Gmail.';

function showApp(path: string, user: typeof ME | null) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ mode: 'prod' }))),
  );
  vi.mocked(api.get).mockRejectedValue(new ApiError('Not found', 'http', 404));
  vi.mocked(api.getGmailStatus).mockRejectedValue(new ApiError('n/a', 'http', 404));
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('the app on app.northlist.site has no product page', () => {
  it('sends a signed-in user from / to the Dashboard', async () => {
    const router = showApp('/', ME);
    expect(
      await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.queryByRole('heading', { name: TITLE })).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor from / to sign-in, with no next', async () => {
    const router = showApp('/', null);
    expect(
      await screen.findByRole('heading', { name: 'Sign in to NorthList' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({});
    expect(screen.queryByRole('heading', { name: TITLE })).not.toBeInTheDocument();
  });

  it('still sends a signed-out visitor from any other page to sign-in', async () => {
    const router = showApp('/mails', null);
    expect(
      await screen.findByRole('heading', { name: 'Sign in to NorthList' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ next: '/mails' });
  });
});
