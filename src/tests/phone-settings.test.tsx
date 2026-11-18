// @vitest-environment jsdom
/**
 * The phone's Settings tab and owner screens in the Linear look (owner, 18 Nov 2026, approved mock
 * `PHONE-LINEAR-mock/` screens 8–16): plain rows, Owner › Admin, the Admin page with its account
 * pages and message sheet, the message notice, and what a suspended user sees.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { User } from '../api/auth';
import { SuspendedPage } from '../components/admin/SuspendedPage';
import type { AdminAccount, AdminOverview } from '../contracts/admin';
import type { AdminMessagesResponse } from '../contracts/messages';
import { routeTree } from '../routeTree.gen';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: {
    get: vi.fn(),
    post: vi.fn(),
    getGmailStatus: vi.fn(),
    getAISettings: vi.fn(),
    listIntegrationTokens: vi.fn(),
  },
}));

const PHONE_WIDTH = 390;
const NOW = new Date();
const iso = (daysAgo = 0) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

const account = (overrides: Partial<AdminAccount> = {}): AdminAccount => ({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'sam.lee@example.com',
  name: 'Sam Lee',
  testAccount: false,
  self: false,
  createdAt: iso(9),
  lastActiveAt: iso(),
  gmail: { state: 'CONNECTED', lastSyncedAt: iso() },
  ai: { provider: 'career-companion', keyProblem: null },
  limitsReached: { ai: true, replies: false },
  aiDailyLimit: 250,
  aiFailedLast24h: 0,
  mailsChecked30d: 212,
  applications: 9,
  suspension: null,
  ...overrides,
});

const ME = account({
  id: '00000000-0000-4000-8000-000000000000',
  email: 'owner@example.com',
  name: 'Owner',
  self: true,
  limitsReached: { ai: false, replies: false },
});

const OVERVIEW: AdminOverview = {
  generatedAt: NOW.toISOString(),
  betaUserLimit: 99,
  accounts: [ME, account()],
  freeAIPauses: [],
  aiCallsByDay: Array.from({ length: 14 }, (_, i) => ({
    day: iso(13 - i).slice(0, 10),
    calls: 100 * (i + 1),
  })),
};

const SENT: AdminMessagesResponse = {
  messages: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      text: 'New: reply to recruiters from Mails',
      toEmail: null,
      sentAt: iso(),
      alertsSent: 12,
      removedAt: null,
    },
  ],
  alertDevices: { [ME.id]: 2 },
};

let mine: { messages: { id: string; text: string; sentAt: string }[] };

function answer(url: string) {
  if (url === '/api/admin') return OVERVIEW;
  if (url === '/api/admin/free-ai-money')
    return { state: 'OK', todayUsd: 0.42, monthUsd: 3.1, limitUsd: 10, leftUsd: 6.18 };
  if (url === '/api/admin/messages') return SENT;
  if (url === '/api/messages') return mine;
  return Promise.reject(new ApiError('Not found', 'http', 404, 'NOT_FOUND'));
}

const setWidth = (width: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });

let desktopWidth: number;

function show(user: User, path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user },
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const ADMIN: User = { id: ME.id, email: ME.email, name: 'Owner', admin: true };
const USER: User = { id: 'u', email: 'u@example.com', name: 'Nitin' };

beforeEach(() => {
  desktopWidth = window.innerWidth;
  setWidth(PHONE_WIDTH);
  mine = { messages: [] };
  vi.mocked(api.get).mockImplementation(async (url: string) => answer(url));
  vi.mocked(api.post).mockResolvedValue({});
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'me@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
    canSend: true,
  });
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
  vi.mocked(api.listIntegrationTokens).mockResolvedValue({
    items: [],
    metadata: { limit: 20, offset: 0, nextOffset: null },
  });
});
afterEach(() => {
  cleanup();
  setWidth(desktopWidth);
  vi.clearAllMocks();
});

describe('the Settings tab', () => {
  it('shows you at the top, then Set up and This phone as plain rows, and Sign out', async () => {
    show(USER, '/settings');
    const you = await screen.findByRole('link', { name: 'Account, u@example.com' });
    expect(you).toHaveAttribute('href', '/account');
    expect(within(you).getByText('Nitin')).toBeInTheDocument();
    for (const label of ['Set up', 'This phone'])
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    // No coloured icon squares any more: the rows are words only.
    expect(
      screen.getByRole('link', { name: /^Gmail sync/ }).querySelector('svg.lucide-refresh-cw'),
    ).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Owner' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('shows Owner › Admin with what needs a look, for an admin only', async () => {
    show(ADMIN, '/settings');
    expect(await screen.findByRole('heading', { name: 'Owner' })).toBeInTheDocument();
    const admin = screen.getByRole('link', { name: /^Admin/ });
    expect(admin).toHaveAttribute('href', '/admin');
    // Sam reached the daily AI limit: one thing needs a look.
    await waitFor(() => expect(admin).toHaveTextContent('1 needs a look'));
  });
});

describe('the Admin page on phones', () => {
  it('shows four numbers in one line, what needs a look and the accounts as rows', async () => {
    show(ADMIN, '/admin');
    expect(await screen.findByText('of 99 places')).toBeInTheDocument();
    for (const label of ['Gmail on', 'New this week', 'AI calls today'])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Needs a look · 1' })).toBeInTheDocument();
    const sam = screen.getByRole('link', { name: /^Sam Lee/ });
    expect(sam).toHaveAttribute('href', `/admin/accounts/${account().id}`);
    expect(within(sam).getByText('Daily limit reached')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Free AI money/ })).toHaveAttribute(
      'href',
      '/admin/money',
    );
    expect(await screen.findByText('$6.18 left')).toBeInTheDocument();
  });

  it('writes a message to everyone from the bottom bar, with the alert off at first', async () => {
    show(ADMIN, '/admin');
    fireEvent.click(await screen.findByRole('button', { name: 'Message to everyone' }));
    const send = await screen.findByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Also send as an alert' })).not.toBeChecked();
    expect(await screen.findByText('New: reply to recruiters from Mails')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Down for 30 minutes tonight.' },
    });
    expect(screen.getByText('28 / 500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/admin/messages', {
        text: 'Down for 30 minutes tonight.',
        to: 'EVERYONE',
        alsoAlert: false,
      }),
    );
  });
});

describe('an account page on phones', () => {
  it('shows the facts as pills, and Suspend needs a reason', async () => {
    show(ADMIN, `/admin/accounts/${account().id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Sam Lee' })).toBeInTheDocument();
    const facts = screen.getByRole('list', { name: 'Facts' });
    expect(within(facts).getByText('Free AI')).toBeInTheDocument();
    expect(within(facts).getByText('Daily limit')).toBeInTheDocument();
    expect(within(facts).getByText('212 mails · 30 days')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More for sam.lee@example.com' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Suspend…' }));
    const sheet = await screen.findByRole('dialog', { name: 'Suspend Sam Lee' });
    const suspend = within(sheet).getByRole('button', { name: 'Suspend' });
    expect(suspend).toBeDisabled();
    fireEvent.change(within(sheet).getByRole('textbox'), {
      target: { value: 'The login was shared.' },
    });
    fireEvent.click(suspend);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`/api/admin/accounts/${account().id}/suspend`, {
        reason: 'The login was shared.',
      }),
    );
  });
});

describe('a message from NorthList on phones', () => {
  it('shows as a plain card with the blue dot, and × closes it', async () => {
    mine = { messages: [{ id: SENT.messages[0].id, text: 'Down tonight.', sentAt: iso() }] };
    show(USER, '/settings');
    const notice = await screen.findByRole('region', { name: 'Messages from NorthList' });
    expect(within(notice).getByText('Down tonight.')).toBeInTheDocument();
    expect(notice.querySelector('.lucide-megaphone')).toBeNull();
    fireEvent.click(within(notice).getByRole('button', { name: 'Close message' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`/api/messages/${SENT.messages[0].id}/dismiss`),
    );
  });
});

describe('the suspended page on phones', () => {
  it('shows the reason in a calm page, and Ask to resume sends the request', async () => {
    vi.mocked(api.post).mockResolvedValue({
      id: '44444444-4444-4444-8444-444444444444',
      email: 'u@example.com',
      name: 'Nitin',
      hasPassword: true,
      hasGoogle: false,
      testAccount: false,
      admin: false,
      suspension: {
        suspendedAt: iso(),
        reason: 'The login was shared.',
        request: { text: 'I made my own account.', sentAt: iso() },
      },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SuspendedPage
          suspension={{ suspendedAt: iso(), reason: 'The login was shared.', request: null }}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Your account is suspended' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('WhyThe login was shared.');
    const ask = screen.getByRole('button', { name: 'Ask to resume' });
    expect(ask).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tell us anything we should know'), {
      target: { value: 'I made my own account.' },
    });
    fireEvent.click(ask);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/auth/resume-request', {
        text: 'I made my own account.',
      }),
    );
    expect(await screen.findByText(/Request sent today/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
