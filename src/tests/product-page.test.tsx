// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn(), getGmailStatus: vi.fn(), getAISettings: vi.fn() },
}));

import { ApiError, api } from '../api/client';
import { ProductPage } from '../components/product/ProductPage';
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

/** Every server call the page makes. */
let fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  fetchSpy = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ mode: 'prod' })));
  vi.stubGlobal('fetch', fetchSpy);
  vi.mocked(api.get).mockRejectedValue(new ApiError('Not found', 'http', 404));
  vi.mocked(api.getGmailStatus).mockRejectedValue(new ApiError('n/a', 'http', 404));
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('the product site on northlist.site', () => {
  it('shows what NorthList does, with sign-in on the app site and the privacy policy', () => {
    render(<ProductPage />);
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument();

    const signIn = screen.getAllByRole('link', { name: /^Sign in/ });
    expect(signIn.length).toBe(2);
    for (const link of signIn)
      expect(link).toHaveAttribute('href', 'https://app.northlist.site/login');
    const privacy = screen.getAllByRole('link', { name: /privacy policy/i });
    expect(privacy.length).toBe(3);
    for (const link of privacy) expect(link).toHaveAttribute('href', '/privacy.html');
    expect(screen.getByRole('link', { name: 'nitinsirsath8855@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:nitinsirsath8855@gmail.com',
    );
  });

  it('says why it asks for each Gmail permission', () => {
    render(<ProductPage />);
    const part = screen.getByRole('region', { name: 'What NorthList asks Google for' });
    expect(within(part).getByText('gmail.readonly')).toBeInTheDocument();
    expect(within(part).getByText('gmail.send')).toBeInTheDocument();
    expect(within(part).getByText(/It never sends anything by itself/)).toBeInTheDocument();
  });

  it('asks the server for nothing', () => {
    render(<ProductPage />);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('the app on app.northlist.site has no product page', () => {
  it('sends a signed-in user from / to the Dashboard', async () => {
    const router = showApp('/', ME);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.queryByRole('heading', { name: TITLE })).not.toBeInTheDocument();
  });

  it('sends a signed-out visitor from / to sign-in, with no next', async () => {
    const router = showApp('/', null);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({});
    expect(screen.queryByRole('heading', { name: TITLE })).not.toBeInTheDocument();
  });

  it('still sends a signed-out visitor from any other page to sign-in', async () => {
    const router = showApp('/mails', null);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ next: '/mails' });
  });
});
