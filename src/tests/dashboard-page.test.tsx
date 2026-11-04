// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AIReadingStatusResponse } from '../contracts/ai';
import { dashboardFixture } from './dashboard-fixture';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: { getDashboard: vi.fn(), getGmailStatus: vi.fn(), getAIReading: vi.fn() },
  };
});

import { routeTree } from '../routeTree.gen';

const connected = {
  connected: true,
  gmailEmail: 'me@example.com',
  status: 'CONNECTED' as const,
  syncStatus: 'IDLE' as const,
  lastSyncedAt: null,
};
const idle: AIReadingStatusResponse = {
  state: 'NONE',
  reason: null,
  provider: null,
  model: null,
  notDone: 0,
  done: 0,
  total: 0,
  inLine: false,
  secondsLeft: null,
  resumesAt: null,
  steps: [],
  jobMails: { count: 0, newest: [] },
};

function renderPage(path = '/dashboard') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: { id: 'u', email: 't@test.local', name: 'T' } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.mocked(api.getGmailStatus).mockResolvedValue(connected);
  vi.mocked(api.getAIReading).mockResolvedValue(idle);
  vi.mocked(api.getDashboard).mockResolvedValue(dashboardFixture());
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the Dashboard', () => {
  it('greets the user and puts what needs them first, each tile leading to its list', async () => {
    renderPage();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: /^Good (morning|afternoon|evening), T$/,
      }),
    ).toBeInTheDocument();
    const now = await screen.findByRole('region', { name: 'Needs you now' });
    expect(within(now).getByRole('link', { name: /New job mails/ })).toHaveAttribute(
      'href',
      '/mails?unseen=true',
    );
    expect(within(now).getByRole('link', { name: /Needs action/ })).toHaveAttribute(
      'href',
      '/mails?request=open',
    );
    const interviews = within(now).getByRole('link', { name: /Interviews coming up/ });
    expect(interviews).toHaveAttribute('href', '/mails/thread-9');
    expect(interviews).toHaveTextContent('Next: Thu, Nov 5 · 10:00 AM · Harbor Analytics');
    expect(within(now).getByText('2 today')).toBeInTheDocument();
    expect(api.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ period: '30d' }),
      expect.anything(),
    );
  });

  it('shows the progress of the period and the mailbox', async () => {
    renderPage();
    const progress = await screen.findByRole('region', { name: 'Your progress' });
    expect(within(progress).getByText('↑ 8 vs the 30 days before')).toBeInTheDocument();
    expect(
      within(progress).getByRole('heading', { name: 'Running total this period' }),
    ).toBeInTheDocument();
    expect(within(progress).getByText('Response rate').nextSibling).toHaveTextContent('35%');
    expect(within(progress).getByText('Usual reply time').nextSibling).toHaveTextContent('6 days');
    expect(within(progress).getByRole('link', { name: /Acme Analytics/ })).toHaveAttribute(
      'href',
      '/applications/app-1',
    );
    const mailbox = screen.getByRole('region', { name: 'Your mailbox' });
    expect(within(mailbox).getByText('1,402')).toBeInTheDocument();
    expect(within(mailbox).getByText('214 in the last 30 days')).toBeInTheDocument();
    expect(within(mailbox).getByRole('link', { name: 'Link them on Mails' })).toHaveAttribute(
      'href',
      '/mails?application=none',
    );
    expect(within(mailbox).getByRole('heading', { name: 'Job mails per day' })).toBeInTheDocument();
  });

  it('leaves out what the owner removed: tips, the AI tip and the old cards', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Needs you now' });
    for (const gone of ['Tips', 'Right now', 'Where rejected jobs ended', 'Week by week'])
      expect(screen.queryByText(new RegExp(gone))).not.toBeInTheDocument();
    for (const gone of ['How you keep up', 'Kept safe', 'How fast companies answer'])
      expect(screen.queryByText(gone)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI tip/)).not.toBeInTheDocument();
  });

  it('asks for the period in the address', async () => {
    renderPage('/dashboard?period=90d');
    await screen.findByRole('region', { name: 'Your progress' });
    expect(api.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ period: '90d' }),
      expect.anything(),
    );
  });

  it('says so when nothing needs the user', async () => {
    vi.mocked(api.getDashboard).mockResolvedValue(
      dashboardFixture({
        now: {
          newJobMails: { count: 0, today: 0 },
          needsAction: { count: 0, waitingOverADay: 0 },
          interviews: { count: 0, next: null },
        },
      }),
    );
    renderPage();
    const now = await screen.findByRole('region', { name: 'Needs you now' });
    expect(within(now).getByText('You have opened every job mail')).toBeInTheDocument();
    expect(within(now).getByText('Nothing is waiting on you')).toBeInTheDocument();
    expect(within(now).getByText('No interviews booked yet')).toBeInTheDocument();
    expect(within(now).queryByRole('link', { name: /Interviews coming up/ })).toBeNull();
  });

  it('shows counts, not rates, under 5 applications', async () => {
    const few = dashboardFixture();
    few.funnel = {
      applied: 3,
      answered: 1,
      recruiterContact: 1,
      assessment: 0,
      interview: 0,
      offer: 0,
    };
    vi.mocked(api.getDashboard).mockResolvedValue(few);
    renderPage();
    expect(await screen.findByText('Rates show from 5 applications')).toBeInTheDocument();
    expect(screen.getAllByText('1 of 3').length).toBeGreaterThan(0);
    expect(screen.queryByText('Response rate')).not.toBeInTheDocument();
    // The usual reply time is one line inside the card, not a lone tile.
    expect(screen.queryByText('Usual reply time')).not.toBeInTheDocument();
    expect(screen.getByText(/Companies usually reply in/)).toHaveTextContent(
      'Companies usually reply in 6 days.',
    );
  });

  it('draws weekly bars, grey before the period and blue inside it, and none for empty weeks', async () => {
    const quiet = dashboardFixture();
    quiet.trend.weeks = quiet.trend.weeks.map((week) => ({ ...week, offers: 0 }));
    vi.mocked(api.getDashboard).mockResolvedValue(quiet);
    renderPage();
    const progress = await screen.findByRole('region', { name: 'Your progress' });
    const tile = (name: string) =>
      within(progress)
        .getAllByText(name)
        .find((label) => label.tagName === 'DT')!
        .closest('div')!;
    const bars = tile('Applications sent').querySelectorAll('svg rect');
    expect(bars).toHaveLength(12);
    expect(bars[0]).toHaveClass('fill-chart-4/45');
    expect(bars[11]).toHaveClass('fill-chart-1');
    expect(tile('Offers').querySelector('svg')).toBeNull();
  });

  it('shows what works best only to users of the automation', async () => {
    renderPage();
    await screen.findByRole('region', { name: 'Your mailbox' });
    expect(screen.queryByRole('region', { name: 'What works best' })).not.toBeInTheDocument();
    cleanup();

    const used = dashboardFixture();
    used.automation = { ...used.automation, used: true, sent: 4, lookedAt: 6 };
    vi.mocked(api.getDashboard).mockResolvedValue(used);
    renderPage();
    expect(await screen.findByRole('region', { name: 'What works best' })).toBeInTheDocument();
    // No site or work mode has 5 applications yet: one line instead of tables of "Too few".
    expect(screen.getByText(/Not enough yet/)).toBeInTheDocument();
    expect(screen.queryByText('Too few')).not.toBeInTheDocument();
    expect(screen.getByText('6 jobs looked at')).toBeInTheDocument();
    cleanup();

    const one = dashboardFixture();
    one.automation = {
      ...one.automation,
      used: true,
      sent: 6,
      lookedAt: 1,
      sites: [{ platform: 'linkedin', sent: 6, answered: 2, interviews: 1 }],
    };
    vi.mocked(api.getDashboard).mockResolvedValue(one);
    renderPage();
    expect(await screen.findByText('1 job looked at')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'By site' })).toBeInTheDocument();
    expect(screen.queryByText(/Not enough yet/)).not.toBeInTheDocument();
  });

  it('a new user with no Gmail gets one clear start', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      ...connected,
      connected: false,
      status: null,
    });
    vi.mocked(api.getDashboard).mockResolvedValue(dashboardFixture({ dataStartsAt: null }));
    renderPage();
    expect(await screen.findByText('See your job search in numbers')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Needs you now' })).not.toBeInTheDocument();
  });

  it('while the AI reads the first mails, it shows progress instead of empty numbers', async () => {
    vi.mocked(api.getAIReading).mockResolvedValue({
      ...idle,
      state: 'READING',
      done: 12,
      total: 50,
      secondsLeft: 240,
    });
    const empty = dashboardFixture();
    empty.mailbox = { ...empty.mailbox, jobMails: { total: 0, inPeriod: 0 } };
    vi.mocked(api.getDashboard).mockResolvedValue(empty);
    renderPage();
    expect(await screen.findByText('The AI is reading your mails')).toBeInTheDocument();
    expect(screen.getByText(/about 4 min left. The numbers fill in/)).toBeInTheDocument();
  });
});
