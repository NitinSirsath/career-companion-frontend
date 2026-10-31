// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}));

import { ApiError, api } from '../api/client';
import { AccountPage } from '../components/auth/AccountPage';
import { CreateTestUserForm } from '../components/auth/CreateTestUserForm';
import { LoginPage } from '../components/auth/LoginPage';
import { PasswordSignInForm } from '../components/auth/PasswordSignInForm';
import type { UserProfile } from '../contracts/auth';
import { googleSignInProblem, setPasswordFormSchema, signInProblem } from '../lib/signIn';

const post = vi.mocked(api.post);
const get = vi.mocked(api.get);
const modeFetch = vi.fn<typeof fetch>();
const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'alex@example.com',
  name: 'Alex',
  hasPassword: false,
  hasGoogle: true,
  testAccount: false,
  ...overrides,
});

function renderWithQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}
const mode = (value: 'dev' | 'prod') =>
  modeFetch.mockImplementation(async () => new Response(JSON.stringify({ mode: value })));
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeEach(() => {
  vi.stubGlobal('fetch', modeFetch);
  mode('prod');
  post.mockReset();
  get.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('sign-in wording', () => {
  it("says the server's own words for the cases written for the user", () => {
    const wrong = new ApiError('Email or password is wrong.', 'http', 401, 'INVALID_CREDENTIALS');
    expect(signInProblem(wrong)).toBe('Email or password is wrong.');
    const blocked = new ApiError(
      'Too many tries. Try again in 15 minutes.',
      'http',
      429,
      'TOO_MANY_ATTEMPTS',
      { retryAfterSeconds: 900 },
    );
    expect(signInProblem(blocked)).toBe('Too many tries. Try again in 15 minutes.');
    expect(signInProblem(new ApiError('x', 'http', 400, 'VALIDATION_ERROR'))).toBe(
      'Check what you entered and try again.',
    );
    expect(signInProblem(new ApiError('Network error.', 'network'))).toBe('Network error.');
    expect(signInProblem(new ApiError('boom', 'http', 500))).toBe(
      'Something went wrong. Try again.',
    );
    expect(signInProblem(new Error('boom'))).toBe('Something went wrong. Try again.');
  });

  it('explains a failed Google sign-in', () => {
    expect(googleSignInProblem('denied')).toMatch(/denied/);
    expect(googleSignInProblem('expired')).toMatch(/expired/);
    expect(googleSignInProblem('anything')).toMatch(/unexpected/);
  });

  it('checks the set-password form', () => {
    const first = setPasswordFormSchema(false);
    expect(
      first.safeParse({ newPassword: 'long enough 1', repeatPassword: 'long enough 1' }).success,
    ).toBe(true);
    expect(first.safeParse({ newPassword: 'short', repeatPassword: 'short' }).success).toBe(false);
    const mismatch = first.safeParse({ newPassword: 'long enough 1', repeatPassword: 'different' });
    expect(mismatch.error?.issues[0]).toMatchObject({
      path: ['repeatPassword'],
      message: 'The two passwords are not the same.',
    });
    const change = setPasswordFormSchema(true).safeParse({
      newPassword: 'long enough 1',
      repeatPassword: 'long enough 1',
    });
    expect(change.error?.issues[0]).toMatchObject({ path: ['currentPassword'] });
  });
});

describe('login page', () => {
  it('offers email and password and Google in prod mode, and no test user', async () => {
    renderWithQuery(<LoginPage error="denied" />);
    await waitFor(() => expect(modeFetch).toHaveBeenCalled());
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Create test user' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/denied the sign-in request/);
    expect(screen.getByText(/Forgot your password\?/)).toBeInTheDocument();
  });

  it('says the beta is full as a warning with the address to ask for a place', async () => {
    renderWithQuery(<LoginPage error="beta_full" />);
    await waitFor(() => expect(modeFetch).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent(
      'The NorthList beta is full. The beta is limited to 100 users and every place is taken. To ask for a place, write to nitinsirsath8855@gmail.com.',
    );
    expect(
      within(notice).getByRole('link', { name: 'nitinsirsath8855@gmail.com' }),
    ).toHaveAttribute('href', 'mailto:nitinsirsath8855@gmail.com');
    expect(googleSignInProblem('beta_full')).toBe(notice.textContent);
  });

  it('offers a test user and no Google sign-in in dev mode', async () => {
    mode('dev');
    renderWithQuery(<LoginPage />);
    expect(await screen.findByRole('form', { name: 'Create test user' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^Dev mode/);
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in with Google' })).not.toBeInTheDocument();
  });
});

describe('sign in with email and password', () => {
  it('signs in and then opens the app', async () => {
    post.mockResolvedValue(profile({ hasPassword: true }));
    const onSignedIn = vi.fn();
    renderWithQuery(<PasswordSignInForm onSignedIn={onSignedIn} />);
    type('Email', '  Alex@Example.com ');
    type('Password', 'correct horse battery');
    press('Sign in');
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/api/auth/login', {
      email: 'alex@example.com',
      password: 'correct horse battery',
    });
  });

  it('asks for a valid email and a password before it sends anything', async () => {
    renderWithQuery(<PasswordSignInForm onSignedIn={vi.fn()} />);
    type('Email', 'not-an-email');
    press('Sign in');
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('shows why sign-in was refused, and does not open the app', async () => {
    post.mockRejectedValue(
      new ApiError('Email or password is wrong.', 'http', 401, 'INVALID_CREDENTIALS'),
    );
    const onSignedIn = vi.fn();
    renderWithQuery(<PasswordSignInForm onSignedIn={onSignedIn} />);
    type('Email', 'alex@example.com');
    type('Password', 'not the password');
    press('Sign in');
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is wrong.');
    expect(onSignedIn).not.toHaveBeenCalled();

    post.mockRejectedValue(
      new ApiError('Too many tries. Try again in 15 minutes.', 'http', 429, 'TOO_MANY_ATTEMPTS'),
    );
    press('Sign in');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Too many tries. Try again in 15 minutes.',
      ),
    );
  });
});

describe('create test user', () => {
  it('creates the user with no name when the name is left empty', async () => {
    post.mockResolvedValue(profile({ hasPassword: true, hasGoogle: false, name: null }));
    const onSignedIn = vi.fn();
    renderWithQuery(<CreateTestUserForm onSignedIn={onSignedIn} />);
    type('Email', 'alex@test.local');
    type('Password', 'a good long password');
    press('Create test user');
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(post).toHaveBeenCalledWith('/api/auth/register', {
      email: 'alex@test.local',
      password: 'a good long password',
    });
  });

  it('sends the name when one is given, and refuses a short password', async () => {
    post.mockResolvedValue(profile({ hasPassword: true, hasGoogle: false }));
    renderWithQuery(<CreateTestUserForm onSignedIn={vi.fn()} />);
    type(/^Name/, ' Alex Tester ');
    type('Email', 'alex@test.local');
    type('Password', 'short');
    press('Create test user');
    await waitFor(() =>
      expect(screen.getByText('Use at least 10 characters.')).toHaveClass('text-status-error'),
    );
    expect(post).not.toHaveBeenCalled();

    type('Password', 'a good long password');
    press('Create test user');
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/auth/register', {
        email: 'alex@test.local',
        password: 'a good long password',
        name: 'Alex Tester',
      }),
    );
  });
});

describe('account page', () => {
  it('lets a Google user set a first password, then asks for the current one', async () => {
    get.mockResolvedValue(profile());
    post.mockResolvedValue(profile({ hasPassword: true }));
    renderWithQuery(<AccountPage />);
    expect(await screen.findByRole('form', { name: 'Set password' })).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();

    type('New password', 'my first password');
    type('Repeat new password', 'my first passwor');
    press('Save password');
    expect(await screen.findByText('The two passwords are not the same.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    type('Repeat new password', 'my first password');
    press('Save password');
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/auth/password', { newPassword: 'my first password' }),
    );
    expect(await screen.findByRole('form', { name: 'Change password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
    expect(screen.getByText('Set')).toBeInTheDocument();
  });

  it('changes a password with the current one, and says when that one is wrong', async () => {
    get.mockResolvedValue(profile({ hasPassword: true }));
    renderWithQuery(<AccountPage />);
    await screen.findByRole('form', { name: 'Change password' });
    type('New password', 'a brand new password');
    type('Repeat new password', 'a brand new password');
    press('Save password');
    expect(await screen.findByText('Enter your current password.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    post.mockRejectedValue(
      new ApiError('Current password is wrong.', 'http', 403, 'WRONG_PASSWORD'),
    );
    type('Current password', 'not the password');
    press('Save password');
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is wrong.');

    post.mockResolvedValue(profile({ hasPassword: true }));
    type('Current password', 'correct horse battery');
    press('Save password');
    await waitFor(() =>
      expect(post).toHaveBeenLastCalledWith('/api/auth/password', {
        newPassword: 'a brand new password',
        currentPassword: 'correct horse battery',
      }),
    );
    expect(await screen.findByText('Password saved.')).toBeInTheDocument();
  });
});
