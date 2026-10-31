// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import type { ReactNode } from 'react';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn(), getGmailStatus: vi.fn(), getAISettings: vi.fn() },
}));

import { ApiError, api } from '../api/client';
import { SignInGate } from '../components/startup/SignInGate';
import {
  isPublicPage,
  productPageAtOnce,
  rememberSignedIn,
  wasSignedInBefore,
} from '../lib/signIn';
import { routeTree } from '../routeTree.gen';

const ME = { id: 'u', email: 'u@test.local', name: 'U' };
const TITLE = 'Your job search, sorted from your Gmail.';
/** What /api/auth/me answers. */
let me: () => Promise<Response>;

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function showApp(path: string, user: typeof ME | null) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user },
  });
  wrap(<RouterProvider router={router} />);
  return router;
}

/** The gate at an address, with a stand-in product page and app. */
function showGate(path: string) {
  window.history.replaceState(null, '', path);
  wrap(
    <SignInGate productPage={<p>Product page</p>}>
      {(user) => <p>App for {user ? user.email : 'nobody signed in'}</p>}
    </SignInGate>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  me = () => Promise.resolve(new Response('{}', { status: 401 }));
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input) =>
      input === '/api/auth/me' ? me() : new Response(JSON.stringify({ mode: 'prod' })),
    ),
  );
  vi.mocked(api.get).mockRejectedValue(new ApiError('Not found', 'http', 404));
  vi.mocked(api.getGmailStatus).mockRejectedValue(new ApiError('n/a', 'http', 404));
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('which pages are public', () => {
  it('lets a visitor open the product page and the sign-in pages, and nothing else', () => {
    expect(isPublicPage('/')).toBe(true);
    expect(isPublicPage('/login')).toBe(true);
    expect(isPublicPage('/test-login')).toBe(true);
    expect(isPublicPage('/mails')).toBe(false);
    expect(isPublicPage('/dashboard')).toBe(false);
  });

  it('shows the product page before the server answers only at / in a new browser', () => {
    expect(productPageAtOnce('/', false)).toBe(true);
    expect(productPageAtOnce('/', true)).toBe(false);
    expect(productPageAtOnce('/mails', false)).toBe(false);
  });

  it('remembers that someone signed in on this browser', () => {
    expect(wasSignedInBefore()).toBe(false);
    rememberSignedIn();
    expect(wasSignedInBefore()).toBe(true);
  });
});

describe('the product page at /', () => {
  it('shows a signed-out visitor what NorthList does, with sign-in and the privacy policy', async () => {
    const router = showApp('/', null);
    expect(await screen.findByRole('heading', { name: TITLE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(document.title).toBe('NorthList · Your job search, sorted from your Gmail');

    const signIn = screen.getAllByRole('link', { name: /^Sign in/ });
    expect(signIn.length).toBe(2);
    for (const link of signIn) expect(link).toHaveAttribute('href', '/login');
    const privacy = screen.getAllByRole('link', { name: /privacy policy/i });
    expect(privacy.length).toBe(3);
    for (const link of privacy) expect(link).toHaveAttribute('href', '/privacy.html');
    expect(screen.getByRole('link', { name: 'nitinsirsath8855@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:nitinsirsath8855@gmail.com',
    );
  });

  it('says why it asks for each Gmail permission', async () => {
    showApp('/', null);
    const part = await screen.findByRole('region', { name: 'What NorthList asks Google for' });
    expect(within(part).getByText('gmail.readonly')).toBeInTheDocument();
    expect(within(part).getByText('gmail.send')).toBeInTheDocument();
    expect(within(part).getByText(/It never sends anything by itself/)).toBeInTheDocument();
  });

  it('gives the tab back its name when the visitor moves on', async () => {
    const router = showApp('/', null);
    await screen.findByRole('heading', { name: TITLE });
    await act(() => router.navigate({ to: '/login' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(document.title).toBe('NorthList');
  });

  it('sends a signed-in user on to the Dashboard', async () => {
    const router = showApp('/', ME);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.queryByRole('heading', { name: TITLE })).not.toBeInTheDocument();
  });

  it('still sends a signed-out visitor from any other page to sign-in', async () => {
    const router = showApp('/mails', null);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ next: '/mails' });
  });
});

describe('before the server answers', () => {
  const waiting = () => new Promise<Response>(() => undefined);

  it('shows the product page at once at / in a browser where nobody has signed in', () => {
    me = waiting;
    showGate('/');
    expect(screen.getByText('Product page')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('waits as before in a browser where someone has signed in', () => {
    me = waiting;
    rememberSignedIn();
    showGate('/');
    expect(screen.getByRole('status')).toHaveTextContent('Loading NorthList');
    expect(screen.queryByText('Product page')).not.toBeInTheDocument();
  });

  it('waits as before on every other page', () => {
    me = waiting;
    showGate('/mails');
    expect(screen.getByRole('status')).toHaveTextContent('Loading NorthList');
  });

  it('opens the app once the server answers, and remembers a signed-in user', async () => {
    me = () => Promise.resolve(new Response(JSON.stringify(ME)));
    showGate('/');
    expect(await screen.findByText('App for u@test.local')).toBeInTheDocument();
    expect(wasSignedInBefore()).toBe(true);
  });

  it('remembers nothing for a visitor who is not signed in', async () => {
    showGate('/');
    expect(await screen.findByText('App for nobody signed in')).toBeInTheDocument();
    expect(wasSignedInBefore()).toBe(false);
  });
});
