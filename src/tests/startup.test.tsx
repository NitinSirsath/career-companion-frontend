// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import type { ReactNode } from 'react';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn(), getGmailStatus: vi.fn(), getAISettings: vi.fn() },
}));

import { ApiError, api } from '../api/client';
import { LoginPage } from '../components/auth/LoginPage';
import { SignInGate } from '../components/startup/SignInGate';
import { googleSignInUrl, safeNextPath } from '../lib/signIn';
import { startupStage, waitedLabel } from '../lib/startup';
import { routeTree } from '../routeTree.gen';

const ME = { id: 'u', email: 'u@test.local', name: 'U' };
const backend = vi.fn<typeof fetch>();
/** What /api/auth/me answers, one entry per try; the last one repeats. */
let answers: (() => Promise<Response>)[];
const status = (code: number) => () => Promise.resolve(new Response('{}', { status: code }));
const signedIn = () => Promise.resolve(new Response(JSON.stringify(ME)));
const networkDown = () => Promise.reject(new TypeError('Failed to fetch'));
const tries = () => backend.mock.calls.filter(([url]) => url === '/api/auth/me').length;

function wrap(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
/** The gate around a stand-in for the app, which names the user it was given. */
const showGate = () =>
  wrap(
    <SignInGate>{(user) => <p>App for {user ? user.email : 'nobody signed in'}</p>}</SignInGate>,
  );
/** Lets the clock run, and the tries it starts finish. */
const wait = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  answers = [status(401)];
  backend.mockImplementation(async (input) => {
    if (input !== '/api/auth/me') return new Response(JSON.stringify({ mode: 'prod' }));
    const answer = answers.length > 1 ? answers.shift()! : answers[0];
    return answer();
  });
  vi.stubGlobal('fetch', backend);
  vi.mocked(api.get).mockRejectedValue(new ApiError('Not found', 'http', 404));
  vi.mocked(api.getGmailStatus).mockRejectedValue(new ApiError('n/a', 'http', 404));
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('start-up timing', () => {
  it('checks quietly first, says the server is waking after 5 seconds, gives up after 2 minutes', () => {
    expect(startupStage(0, true)).toBe('checking');
    expect(startupStage(4_999, true)).toBe('checking');
    expect(startupStage(5_000, true)).toBe('waking');
    expect(startupStage(119_999, true)).toBe('waking');
    expect(startupStage(120_000, true)).toBe('cannot-reach');
    expect(startupStage(1_000, false)).toBe('offline');
  });

  it('shows the time waited as on a clock', () => {
    expect(waitedLabel(7_400)).toBe('0:07');
    expect(waitedLabel(65_000)).toBe('1:05');
  });
});

describe('the page to open after sign-in', () => {
  it('keeps a path inside the app, with its search', () => {
    expect(safeNextPath('/applications/123')).toBe('/applications/123');
    expect(safeNextPath('/mails?tab=gmail&unseen=true')).toBe('/mails?tab=gmail&unseen=true');
  });

  it('ignores anything else, and the sign-in pages themselves', () => {
    for (const value of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'applications/123',
      '/mails with space',
      '',
      '/login',
      '/login?next=/mails',
      '/test-login',
      undefined,
      42,
    ])
      expect(safeNextPath(value)).toBeNull();
  });

  it('passes the page to Google sign-in as returnTo', () => {
    expect(googleSignInUrl(null)).toBe('/api/auth/connect');
    expect(googleSignInUrl('/mails?tab=gmail')).toBe(
      '/api/auth/connect?returnTo=%2Fmails%3Ftab%3Dgmail',
    );
  });
});

describe('the start-up screen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  it('shows only the logo and a moving line while it checks, never the app', async () => {
    answers = [() => new Promise<Response>(() => undefined)];
    showGate();
    expect(screen.getByRole('status')).toHaveTextContent('Loading Career Companion');
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(/^App for/)).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('opens the app for the signed-in user', async () => {
    answers = [signedIn];
    showGate();
    await wait(0);
    expect(screen.getByText('App for u@test.local')).toBeInTheDocument();
  });

  it('opens the app signed out on a 401', async () => {
    showGate();
    await wait(0);
    expect(screen.getByText('App for nobody signed in')).toBeInTheDocument();
  });

  it('says the server is waking while it answers 502, tries again, and opens once it answers', async () => {
    answers = [status(502), status(502), status(502), signedIn];
    showGate();
    await wait(0);
    expect(screen.queryByText(/^App for/)).not.toBeInTheDocument();
    await wait(5_000);
    expect(screen.getByText('Waking up the server…')).toBeInTheDocument();
    expect(screen.getByText(/takes about a minute/)).toBeInTheDocument();
    expect(screen.getByText('Waiting 0:05')).toBeInTheDocument();
    expect(tries()).toBeGreaterThanOrEqual(2);
    await wait(6_000);
    expect(screen.getByText('App for u@test.local')).toBeInTheDocument();
  });

  it('never opens the app signed out because the server did not answer, and stops after 2 minutes', async () => {
    answers = [networkDown];
    showGate();
    await wait(119_000);
    expect(screen.getByText('Waking up the server…')).toBeInTheDocument();
    await wait(2_000);
    expect(screen.getByText("Can't reach the server")).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByText(/^App for/)).not.toBeInTheDocument();
    const triesWhenStopped = tries();
    await wait(30_000);
    expect(tries()).toBe(triesWhenStopped);

    answers = [signedIn];
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await wait(0);
    expect(screen.getByText('App for u@test.local')).toBeInTheDocument();
  });

  it('says so when the device is offline, and tries again when it is back', async () => {
    answers = [networkDown];
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    showGate();
    await wait(0);
    expect(screen.getByText("You're offline")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    answers = [signedIn];
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await wait(0);
    expect(screen.getByText('App for u@test.local')).toBeInTheDocument();
  });
});

describe('signing in returns to the page asked for', () => {
  function showApp(path: string, user: typeof ME | null) {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: [path] }),
      context: { user },
    });
    wrap(<RouterProvider router={router} />);
    return router;
  }

  it('sends a signed-out visitor to sign-in with the page as next', async () => {
    const router = showApp('/applications?status=OFFER', null);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ next: '/applications?status=OFFER' });
  });

  it('asks for no next on the home page', async () => {
    const router = showApp('/', null);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(router.state.location.search).toEqual({});
  });

  it('opens next at once for a signed-in user, and only when it is a page of the app', async () => {
    let router = showApp('/login?next=%2Fapplications%3Fstatus%3DOFFER', ME);
    expect(await screen.findByRole('heading', { name: 'Applications' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/applications');
    expect(router.state.location.search).toMatchObject({ status: 'OFFER' });
    cleanup();

    router = showApp('/login?next=%2F%2Fevil.example', ME);
    expect(await screen.findByRole('heading', { name: 'Mails' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/mails');
  });

  it('opens next after a password sign-in, and passes it on to Google', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      set href(url: string) {
        assign(url);
      },
    });
    vi.mocked(api.post).mockResolvedValue({
      ...ME,
      id: '11111111-1111-4111-8111-111111111111',
      hasPassword: true,
      hasGoogle: false,
      testAccount: false,
    });
    wrap(<LoginPage next="/applications/123" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }));
    expect(assign).toHaveBeenLastCalledWith('/api/auth/connect?returnTo=%2Fapplications%2F123');

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'u@test.local' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await vi.waitFor(() => expect(assign).toHaveBeenLastCalledWith('/applications/123'));
  });
});
