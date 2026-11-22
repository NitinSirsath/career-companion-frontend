// @vitest-environment jsdom
/**
 * Get an invite for the release (owner, 22 Nov 2026, approved mock `INVITE-mock/`): the form under
 * the beta-full warning, the thank-you, and the Release invites list on the Admin page.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('../components/ui/toast', () => ({ showToast: vi.fn() }));

import { ApiError, api } from '../api/client';
import { AdminInvites, INVITES_SHOWN, PhoneInvites } from '../components/admin/AdminInvites';
import { LoginPage } from '../components/auth/LoginPage';
import { showToast } from '../components/ui/toast';
import type { AdminInvite } from '../contracts/invites';
import { inviteSourceLabel } from '../lib/invites';

const post = vi.mocked(api.post);
const get = vi.mocked(api.get);
const modeFetch = vi.fn<typeof fetch>();

function renderWithQuery(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const setWidth = (width: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
let wideWidth: number;

beforeEach(() => {
  wideWidth = window.innerWidth;
  vi.stubGlobal('fetch', modeFetch);
  modeFetch.mockImplementation(async () => new Response(JSON.stringify({ mode: 'prod' })));
  post.mockReset();
  get.mockReset();
});
afterEach(() => {
  cleanup();
  setWidth(wideWidth);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

async function openForm() {
  renderWithQuery(<LoginPage error="beta_full" />);
  await waitFor(() => expect(modeFetch).toHaveBeenCalled());
  return screen.getByRole('form', { name: 'Get an invite' });
}

describe('the invite form when the beta is full', () => {
  it('sends the email and the picked source, then says the person is on the list', async () => {
    post.mockResolvedValue({ saved: true });
    const form = await openForm();
    fireEvent.change(within(form).getByLabelText('Email'), {
      target: { value: ' Ada@Example.com ' },
    });
    fireEvent.click(within(form).getByRole('radio', { name: 'LinkedIn' }));
    expect(within(form).getByRole('radio', { name: 'LinkedIn' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(within(form).getByRole('button', { name: 'Get an invite' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/invites', {
        email: 'ada@example.com',
        source: 'LINKEDIN',
      }),
    );
    const thanks = await screen.findByText("You're on the list.");
    expect(thanks.closest('[role="status"]')).toHaveTextContent(
      'We’ll write to ada@example.com when NorthList opens.',
    );
    expect(screen.queryByRole('form', { name: 'Get an invite' })).not.toBeInTheDocument();
    expect(screen.queryByText(/The NorthList beta is full/)).not.toBeInTheDocument();
  });

  it('asks for a valid email and a source before sending anything', async () => {
    const form = await openForm();
    fireEvent.click(within(form).getByRole('button', { name: 'Get an invite' }));
    expect(await within(form).findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(within(form).getByText('Pick where you heard about NorthList.')).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('opens a short "Where?" field for Other and sends those words', async () => {
    post.mockResolvedValue({ saved: true });
    const form = await openForm();
    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'bo@example.com' } });
    expect(within(form).queryByLabelText('Where?')).not.toBeInTheDocument();
    fireEvent.click(within(form).getByRole('radio', { name: 'Other' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Get an invite' }));
    expect(await within(form).findByText('Say where, in a few words.')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Where?'), { target: { value: 'A podcast' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Get an invite' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/invites', {
        email: 'bo@example.com',
        source: 'OTHER',
        otherSource: 'A podcast',
      }),
    );
  });

  it('shows the contact address when the list is full, and the server words when limited', async () => {
    post.mockRejectedValueOnce(
      new ApiError(
        'We could not save your request. Write to us instead.',
        'http',
        503,
        'INVITE_LIST_FULL',
      ),
    );
    const form = await openForm();
    fireEvent.change(within(form).getByLabelText('Email'), { target: { value: 'cy@example.com' } });
    fireEvent.click(within(form).getByRole('radio', { name: 'X' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Get an invite' }));
    const alert = await within(form).findByRole('alert');
    expect(alert).toHaveTextContent('We could not save your request. Write to us instead.');
    expect(within(alert).getByRole('link', { name: 'northlist.site@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:northlist.site@gmail.com',
    );

    post.mockRejectedValueOnce(
      new ApiError(
        'Too many requests. Wait a minute and try again.',
        'http',
        429,
        'TOO_MANY_REQUESTS',
      ),
    );
    fireEvent.click(within(form).getByRole('button', { name: 'Get an invite' }));
    await waitFor(() =>
      expect(within(form).getByRole('alert')).toHaveTextContent(
        'Too many requests. Wait a minute and try again.',
      ),
    );
  });

  it('opens the form in a sheet on phones, then shows the thank-you on the screen', async () => {
    setWidth(375);
    post.mockResolvedValue({ saved: true });
    renderWithQuery(<LoginPage error="beta_full" />);
    await waitFor(() => expect(modeFetch).toHaveBeenCalled());
    expect(screen.queryByRole('form', { name: 'Get an invite' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Get an invite' }));
    const sheet = await screen.findByRole('dialog', { name: 'Get an invite' });
    fireEvent.change(within(sheet).getByLabelText('Email'), {
      target: { value: 'mei@example.com' },
    });
    fireEvent.click(within(sheet).getByRole('radio', { name: 'YouTube' }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Get an invite' }));
    expect(await screen.findByText("You're on the list.")).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/api/invites', {
      email: 'mei@example.com',
      source: 'YOUTUBE',
    });
    // Google sign-in is still there for members.
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });
});

const invite = (n: number, overrides: Partial<AdminInvite> = {}): AdminInvite => ({
  email: `person${n}@example.com`,
  source: 'FRIEND',
  otherSource: null,
  createdAt: new Date(Date.UTC(2026, 10, 22, 12) - n * 86_400_000).toISOString(),
  ...overrides,
});

describe('Release invites on the Admin page', () => {
  it('lists email, source and date, 10 first, then all', async () => {
    const all = Array.from({ length: INVITES_SHOWN + 2 }, (_, n) =>
      invite(n, n === 0 ? { source: 'OTHER', otherSource: 'A podcast' } : {}),
    );
    get.mockResolvedValue({ invites: all });
    renderWithQuery(<AdminInvites />);
    expect(await screen.findByText('person0@example.com')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/api/admin/invites', expect.anything());
    expect(screen.getByRole('heading', { name: /Release invites/ })).toHaveTextContent('· 12');
    expect(screen.getByText('Other: A podcast')).toBeInTheDocument();
    expect(screen.getByText('Nov 22')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(INVITES_SHOWN + 1);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 12' }));
    expect(screen.getByText('person11@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('copies every email, one per line', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    get.mockResolvedValue({ invites: [invite(1), invite(2)] });
    renderWithQuery(<AdminInvites />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy emails' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('person1@example.com\nperson2@example.com'),
    );
    expect(showToast).toHaveBeenCalledWith('Copied 2 emails');
  });

  it('says when nobody has asked yet, and shows the same rows on phones', async () => {
    get.mockResolvedValue({ invites: [] });
    const view = renderWithQuery(<AdminInvites />);
    expect(await screen.findByText(/No requests yet\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy emails' })).not.toBeInTheDocument();
    view.unmount();

    get.mockResolvedValue({ invites: [invite(3, { source: 'SEARCH' })] });
    renderWithQuery(<PhoneInvites />);
    expect(await screen.findByText('person3@example.com')).toBeInTheDocument();
    expect(screen.getByText('Google search')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Release invites · 1' })).toBeInTheDocument();
  });

  it('names every source in words', () => {
    expect(inviteSourceLabel('FRIEND', null)).toBe('A friend or colleague');
    expect(inviteSourceLabel('SEARCH', null)).toBe('Google search');
    expect(inviteSourceLabel('OTHER', 'Reddit')).toBe('Other: Reddit');
    expect(inviteSourceLabel('OTHER', null)).toBe('Other');
  });
});
