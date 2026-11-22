// @vitest-environment jsdom
/**
 * The Admin page and suspension (owner, 18 Nov 2026, approved mock `ADMIN-PANEL-mock/`): only for
 * admins, what needs a look, Suspend with a required reason, Resume, the free AI money line, and
 * the page a suspended user sees instead of the app.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { User } from '../api/auth';
import { SuspendedPage } from '../components/admin/SuspendedPage';
import type { AdminAccount, AdminFreeAIMoney, AdminOverview } from '../contracts/admin';
import type { UserProfile } from '../contracts/auth';
import { accountCounts, moneyLow, needsALook } from '../lib/admin';
import { routeTree } from '../routeTree.gen';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}));

const NOW = new Date();
const iso = (daysAgo = 0) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();

const account = (overrides: Partial<AdminAccount> = {}): AdminAccount => ({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'priya@example.com',
  name: 'Priya Shah',
  testAccount: false,
  self: false,
  createdAt: iso(),
  lastActiveAt: iso(),
  gmail: { state: 'CONNECTED', lastSyncedAt: iso() },
  ai: { provider: 'career-companion', keyProblem: null },
  limitsReached: { ai: false, replies: false },
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
  createdAt: iso(20),
});

const overview = (accounts: AdminAccount[] = [ME, account()]): AdminOverview => ({
  generatedAt: NOW.toISOString(),
  betaUserLimit: 99,
  accounts,
  freeAIPauses: [],
  aiCallsByDay: Array.from({ length: 14 }, (_, i) => ({
    day: iso(13 - i).slice(0, 10),
    calls: 100 * (i + 1),
  })),
});

const OK_MONEY: AdminFreeAIMoney = {
  state: 'OK',
  todayUsd: 0.42,
  monthUsd: 3.1,
  limitUsd: 10,
  leftUsd: 6.18,
};

let current: AdminOverview;
let money: AdminFreeAIMoney;

function answer(url: string) {
  if (url === '/api/admin') return current;
  if (url === '/api/admin/free-ai-money') return money;
  return Promise.reject(new Error(`not in this test: ${url}`));
}

function show(user: User, path = '/admin') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const ADMIN: User = { id: ME.id, email: ME.email, name: 'Owner', admin: true };

beforeEach(() => {
  current = overview();
  money = OK_MONEY;
  vi.mocked(api.get).mockImplementation(async (url: string) => answer(url));
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('who sees the Admin page', () => {
  it('shows "Page not found" to anyone who is not an admin, and asks the server nothing', async () => {
    show({ id: 'u', email: 'u@example.com', name: 'U' });
    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/api/admin', expect.anything());
  });

  it('puts "Admin" in an Owner group of the menu for an admin only', async () => {
    show(ADMIN);
    const menu = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(menu).getByText('Owner')).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });
});

describe('the Admin page', () => {
  it('shows the beta places, the accounts, AI use and the free AI money', async () => {
    show(ADMIN);
    expect(await screen.findByText('Accounts', { selector: 'dt' })).toBeInTheDocument();
    expect(screen.getByText('97 beta places left')).toBeInTheDocument();
    expect(screen.getByText('priya@example.com')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'AI calls per day, last 14 days' })).toBeInTheDocument();
    expect(await screen.findByText('$6.18')).toBeInTheDocument();
    expect(screen.getByText('$0.42')).toBeInTheDocument();
    expect(screen.getByText(/All good\./)).toBeInTheDocument();
    // The admin's own row has no Suspend button.
    expect(screen.getAllByRole('button', { name: 'Suspend' })).toHaveLength(1);
  });

  it('says so when OpenRouter cannot be asked, and the rest of the page still loads', async () => {
    money = { state: 'UNAVAILABLE' };
    show(ADMIN);
    expect(
      await screen.findByText('Could not check OpenRouter. Refresh to try again.'),
    ).toBeInTheDocument();
    expect(screen.getByText('priya@example.com')).toBeInTheDocument();
  });

  it('needs a reason to suspend, then shows the account as suspended', async () => {
    const target = account();
    vi.mocked(api.post).mockResolvedValue({
      account: {
        ...target,
        suspension: { suspendedAt: NOW.toISOString(), reason: 'Too many replies.', request: null },
      },
    });
    show(ADMIN);
    fireEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Suspend' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/Why are they suspended/), {
      target: { value: '  Too many replies.  ' },
    });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`/api/admin/accounts/${target.id}/suspend`, {
        reason: 'Too many replies.',
      }),
    );
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });
});

describe('Needs a look', () => {
  it('lists a resume request first, with its text, then the problems', () => {
    const items = needsALook(
      {
        ...overview([
          ME,
          account({
            email: 'ravi@example.com',
            gmail: { state: 'SYNC_FAILING', lastSyncedAt: null },
            aiFailedLast24h: 2,
          }),
          account({
            id: '22222222-2222-4222-8222-222222222222',
            email: 'dan@example.com',
            suspension: {
              suspendedAt: iso(2),
              reason: 'Shared login.',
              request: { text: 'Please turn it back on.', sentAt: iso() },
            },
          }),
          account({
            id: '33333333-3333-4333-8333-333333333333',
            email: 'meera@example.com',
            ai: { provider: 'openai', keyProblem: 'KEY_REJECTED' },
            limitsReached: { ai: true, replies: false },
          }),
        ]),
        freeAIPauses: [
          { model: 'openai/gpt-5-mini', reason: 'PROVIDER_BUSY', resumesAt: NOW.toISOString() },
        ],
      },
      { ...OK_MONEY, leftUsd: 1.4 },
      NOW,
    );
    expect(items.map((item) => item.title)).toEqual([
      'Resume request',
      'Free AI paused for everyone',
      'Free AI money low',
      'Gmail sync failing · 1 account',
      'AI could not read 2 mails',
      'Own AI key problem · 1 account',
      'Daily limit reached · 1 account',
    ]);
    expect(items[0].resume?.text).toBe('Please turn it back on.');
    expect(items[4].detail).toContain('ravi@example.com (2)');
  });

  it('counts real accounts apart from test accounts, and money is low under a fifth', () => {
    const counts = accountCounts([
      ME,
      account({ testAccount: true }),
      account({ createdAt: iso(10) }),
    ]);
    expect(counts).toMatchObject({ real: 2, test: 1, newThisWeek: 0 });
    expect(moneyLow({ ...OK_MONEY, leftUsd: 1.99 })).toBe(true);
    expect(moneyLow({ ...OK_MONEY, leftUsd: 2 })).toBe(false);
    expect(moneyLow({ ...OK_MONEY, limitUsd: null, leftUsd: null })).toBe(false);
  });
});

describe('the suspended page', () => {
  const suspension: NonNullable<User['suspension']> = {
    suspendedAt: NOW.toISOString(),
    reason: 'Too many replies sent in one hour.',
    request: null,
  };
  const showSuspended = (value = suspension) =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SuspendedPage suspension={value} />
      </QueryClientProvider>,
    );

  it('says why, and sends the resume request', async () => {
    const profile: UserProfile = {
      id: '44444444-4444-4444-8444-444444444444',
      email: 'dan@example.com',
      name: 'Dan',
      hasPassword: false,
      hasGoogle: true,
      testAccount: false,
      admin: false,
      suspension: { ...suspension, request: { text: 'Please.', sentAt: NOW.toISOString() } },
      onboarding: null,
    };
    vi.mocked(api.post).mockResolvedValue(profile);
    showSuspended();
    expect(screen.getByRole('heading', { name: 'Your account is suspended' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Why: Too many replies sent in one hour.');
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tell us anything we should know'), {
      target: { value: 'Please.' },
    });
    fireEvent.click(send);
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/auth/resume-request', { text: 'Please.' }),
    );
    expect(await screen.findByText(/Request sent today/)).toBeInTheDocument();
  });

  it('shows a request already sent, which can be changed', () => {
    showSuspended({ ...suspension, request: { text: 'Old text', sentAt: NOW.toISOString() } });
    expect(screen.getByText(/Request sent today/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change my request' }));
    expect(screen.getByLabelText('Tell us anything we should know')).toHaveValue('Old text');
  });
});
