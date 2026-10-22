// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}));

import { ApiError, api } from '../api/client';
import { useSandboxMailbox } from '../api/appMode';
import { AccountPage } from '../components/auth/AccountPage';
import { TestLoginPage } from '../components/auth/TestLoginPage';
import { DevModeBanner } from '../components/devMode/DevModeBanner';
import { GmailLink } from '../components/ui/GmailLink';
import { googleSignInProblem, signInProblem } from '../lib/signIn';

const post = vi.mocked(api.post);
const get = vi.mocked(api.get);
const backend = vi.fn<typeof fetch>();
const PROFILE = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'dev1@test.com',
  name: null,
  hasPassword: true,
  hasGoogle: false,
  testAccount: true,
};

/** What the backend answers: its mode, and who is signed in (null: nobody). */
function answers(mode: 'dev' | 'prod', user: object | null) {
  backend.mockImplementation(async (input) => {
    if (String(input) === '/api/app-mode') return new Response(JSON.stringify({ mode }));
    if (!user) return new Response('{}', { status: 401 });
    return new Response(JSON.stringify(user));
  });
}

function renderWithQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function SandboxFlag() {
  return <p>{useSandboxMailbox() ? 'sandbox' : 'gmail'}</p>;
}

beforeEach(() => {
  vi.stubGlobal('fetch', backend);
  answers('prod', PROFILE);
  post.mockReset();
  get.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the mailbox of a test account', () => {
  it('is the sandbox for a test account, also outside dev mode', async () => {
    renderWithQuery(<SandboxFlag />);
    expect(await screen.findByText('sandbox')).toBeInTheDocument();
  });

  it('is Gmail for a real user, and for nobody signed in', async () => {
    answers('prod', { ...PROFILE, email: 'alex@example.com', testAccount: false });
    renderWithQuery(<SandboxFlag />);
    await waitFor(() => expect(backend).toHaveBeenCalledWith('/api/auth/me', expect.anything()));
    expect(screen.getByText('gmail')).toBeInTheDocument();
    cleanup();
    answers('prod', null);
    renderWithQuery(<SandboxFlag />);
    await waitFor(() => expect(backend).toHaveBeenCalledTimes(4));
    expect(screen.getByText('gmail')).toBeInTheDocument();
  });

  it('shows the test account chip, and no Gmail link', async () => {
    renderWithQuery(
      <>
        <DevModeBanner />
        <GmailLink threadId="18c2f0a1b2c3d4e5" subject="Interview" />
      </>,
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Test account · mail sandbox');
    expect(screen.queryByRole('link', { name: /in Gmail$/ })).not.toBeInTheDocument();
  });

  it('shows no chip to a real user', async () => {
    answers('prod', { ...PROFILE, testAccount: false });
    const { container } = renderWithQuery(<DevModeBanner />);
    await waitFor(() => expect(backend).toHaveBeenCalledTimes(2));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('test account sign-in page', () => {
  it('signs in on the test sign-in, not the normal one', async () => {
    answers('prod', null);
    post.mockResolvedValue(PROFILE);
    const assign = vi.fn();
    vi.stubGlobal('location', {
      ...window.location,
      set href(url: string) {
        assign(url);
      },
    });
    renderWithQuery(<TestLoginPage />);
    expect(screen.getByRole('heading', { name: 'Test account sign-in' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dev1@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-long-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/auth/test-login', {
        email: 'dev1@test.com',
        password: 'a-long-password',
      }),
    );
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
  });

  it("says the server's words when the email is not a test account", async () => {
    answers('prod', null);
    post.mockRejectedValue(
      new ApiError('This page is for test accounts only.', 'http', 403, 'NOT_TEST_ACCOUNT'),
    );
    renderWithQuery(<TestLoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-long-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('This page is for test accounts only.')).toBeInTheDocument();
  });

  it('explains the refusals for test accounts elsewhere', () => {
    const useTestLogin = new ApiError(
      'Test accounts sign in on the test sign-in page.',
      'http',
      403,
      'USE_TEST_LOGIN',
    );
    expect(signInProblem(useTestLogin)).toBe('Test accounts sign in on the test sign-in page.');
    expect(googleSignInProblem('test_account')).toBe(
      'This is a test account. Sign in on the test sign-in page.',
    );
  });
});

describe('account page of a test account', () => {
  it('says the password is set on the server, with no password form', async () => {
    get.mockResolvedValue(PROFILE);
    renderWithQuery(<AccountPage />);
    expect(await screen.findByText(/Your password is set on the server/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /password/i })).not.toBeInTheDocument();
  });
});
