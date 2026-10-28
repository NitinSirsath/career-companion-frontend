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
  it('shows the numbers of the last 30 days, each leading to its list', async () => {
    renderPage();
    expect(await screen.findByText('Right now: 51 active jobs')).toBeInTheDocument();
    expect(screen.getByText('↑ 8 vs the 30 days before')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Interview\\s*2/ })).toHaveAttribute(
      'href',
      '/applications?status=INTERVIEW',
    );
    expect(screen.getByRole('link', { name: '3 not linked to a job' })).toHaveAttribute(
      'href',
      '/mails?application=none',
    );
    expect(screen.getByText('Response rate').nextSibling).toHaveTextContent('35%');
    expect(screen.getByRole('link', { name: 'Acme Analytics' })).toHaveAttribute(
      'href',
      '/applications/app-1',
    );
    expect(screen.getByRole('link', { name: '3 still need you in Mails' })).toHaveAttribute(
      'href',
      '/mails?request=open',
    );
    expect(api.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ period: '30d' }),
      expect.anything(),
    );
  });

  it('asks for the period in the address', async () => {
    renderPage('/dashboard?period=90d');
    await screen.findByText('Right now: 51 active jobs');
    expect(api.getDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ period: '90d' }),
      expect.anything(),
    );
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
  });

  it('without the automation, the site cards say where they come from', async () => {
    renderPage();
    const section = await screen.findByRole('region', { name: 'What works best' });
    expect(within(section).getAllByText('Comes from your automation')).toHaveLength(2);
    expect(within(section).getAllByRole('link', { name: 'Set up automation' })[0]).toHaveAttribute(
      'href',
      '/automation?tab=setup',
    );
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
    expect(screen.queryByText(/active jobs/)).not.toBeInTheDocument();
  });

  it('while the AI reads the first mails, it shows progress instead of empty numbers', async () => {
    vi.mocked(api.getAIReading).mockResolvedValue({
      ...idle,
      state: 'READING',
      done: 12,
      total: 50,
      secondsLeft: 240,
    });
    vi.mocked(api.getDashboard).mockResolvedValue(
      dashboardFixture({
        data: { jobMailsRead: 0, notLinked: 0, waitingForAI: 38, fakeOffers: 0 },
      }),
    );
    renderPage();
    expect(await screen.findByText('The AI is reading your mails')).toBeInTheDocument();
    expect(screen.getByText(/about 4 min left. The numbers fill in/)).toBeInTheDocument();
  });
});
