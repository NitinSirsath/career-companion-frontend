// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AIReadingStatusResponse, AISettingsResponse } from '../contracts/ai';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: { getGmailStatus: vi.fn(), getAISettings: vi.fn(), getAIReading: vi.fn() },
  };
});

import { aiReadingKey } from '../api/aiReading';
import { DONE_MS } from '../components/layout/useReadingView';
import { routeTree } from '../routeTree.gen';

const JOB = '00000000-0000-4000-8000-000000000007';
const reading: AIReadingStatusResponse = {
  state: 'READING',
  reason: null,
  provider: 'career-companion',
  model: null,
  notDone: 38,
  done: 12,
  total: 50,
  inLine: false,
  secondsLeft: 230,
  resumesAt: null,
  steps: [
    {
      emailId: '00000000-0000-4000-8000-000000000001',
      subject: 'Your weekly digest from LinkedIn',
      step: 'SORTING',
      provider: 'career-companion',
      model: 'openai/gpt-6-luna',
      category: null,
      companyName: null,
      jobTitle: null,
      at: '2026-10-24T10:00:00.000Z',
    },
  ],
  jobMails: {
    count: 1,
    newest: [
      {
        emailId: JOB,
        category: 'INTERVIEW',
        companyName: 'Northwind',
        jobTitle: 'Frontend Engineer',
      },
    ],
  },
};
const nothing: AIReadingStatusResponse = {
  ...reading,
  state: 'NONE',
  notDone: 0,
  done: 0,
  total: 0,
  secondsLeft: null,
  steps: [],
  jobMails: { count: 0, newest: [] },
};
const settings = {
  configured: true,
  provider: 'career-companion',
  offeredProviders: ['openrouter', 'career-companion'],
  models: null,
  access: {
    state: 'READY',
    reason: null,
    modelId: null,
    resumesAt: null,
    failure: null,
    pauses: [],
    verified: true,
    lastCheckedAt: null,
  },
  lastFailure: null,
  usageToday: { day: '2026-10-24', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 250, resetsAt: '2026-10-25T00:00:00.000Z' },
  waitingEmails: 0,
  needsYourOk: { emails: 0, model: null, lastTriedAt: null, tries: 0 },
  consent: null,
  connections: [],
} satisfies AISettingsResponse;

let queryClient: QueryClient;
let desktopWidth: number;
const setWidth = (width: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });

function show(status: AIReadingStatusResponse) {
  vi.mocked(api.getAIReading).mockResolvedValue(status);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/gmail'] }),
    context: { user: { id: 'u', email: 'u@test.local', name: 'U' } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
const status = () => screen.findByRole('region', { name: 'AI reading status' });

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  desktopWidth = window.innerWidth;
  setWidth(1280);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'a@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
  });
  vi.mocked(api.getAISettings).mockResolvedValue(settings);
});
afterEach(() => {
  vi.useRealTimers();
  setWidth(desktopWidth);
});

describe('the AI reading status in the side menu', () => {
  it('shows the progress, the time, one bar, what the AI does now and the job mails found', async () => {
    show(reading);
    const region = await status();
    expect(within(region).getByText('Reading your new mails')).toBeVisible();
    expect(within(region).getByText('12 of 50 done · about 4 min left')).toBeVisible();
    expect(within(region).getByRole('progressbar', { name: 'New mails done' })).toHaveAttribute(
      'aria-valuenow',
      '12',
    );
    expect(await within(region).findByText('Is it a job mail?')).toHaveClass('ai-shimmer');
    expect(within(region).getByText(/GPT-6 Luna ·/)).toBeVisible();
    expect(within(region).getByText('“Your weekly digest from LinkedIn”')).toBeVisible();
    expect(within(region).getByText('Job mails found · 1')).toBeVisible();
    expect(
      within(region).getByRole('link', { name: 'Interview · Northwind, Frontend Engineer' }),
    ).toHaveAttribute('href', `/mails/${JOB}`);
  });

  it('minimizes the live feed and keeps it minimized', async () => {
    show(reading);
    const region = await status();
    fireEvent.click(within(region).getByRole('button', { name: 'Minimize' }));
    expect(within(region).queryByText('Job mails found · 1')).not.toBeInTheDocument();
    expect(within(region).getByText('12 of 50 done · about 4 min left')).toBeVisible();
    expect(localStorage.getItem('career-companion-reading-feed')).toBe('minimized');
    fireEvent.click(within(region).getByRole('button', { name: 'Show what the AI is doing' }));
    expect(within(region).getByText('Job mails found · 1')).toBeVisible();
  });

  it('sends the user to the AI providers page for a key problem', async () => {
    show({
      ...reading,
      state: 'NEEDS_YOU',
      reason: 'KEY_REJECTED',
      provider: 'openrouter',
      secondsLeft: null,
      steps: [],
      jobMails: { count: 0, newest: [] },
    });
    const region = await status();
    expect(within(region).getByText('OpenRouter rejected your key')).toBeVisible();
    expect(within(region).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Fix it on AI providers' })).toHaveAttribute(
      'href',
      '/ai',
    );
  });

  it('is hidden while nothing waits', async () => {
    show(nothing);
    await screen.findAllByText('Gmail sync');
    await act(() => Promise.resolve());
    expect(screen.queryByRole('region', { name: 'AI reading status' })).not.toBeInTheDocument();
  });

  it('says "done" for 5 seconds after the last mail, then hides', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    show(reading);
    await status();
    // The last mail found one more job mail after the status last asked.
    const found = {
      count: 2,
      newest: [
        {
          emailId: JOB.replace('7', '8'),
          category: 'OFFER' as const,
          companyName: 'Kite',
          jobTitle: null,
        },
        ...reading.jobMails.newest,
      ],
    };
    vi.mocked(api.getAIReading).mockResolvedValue({ ...nothing, jobMails: found });
    await act(() => queryClient.invalidateQueries({ queryKey: aiReadingKey }));
    expect(await screen.findByText('Done reading your new mails')).toBeVisible();
    expect(screen.getByText('Job mails found · 2')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Offer · Kite' })).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(DONE_MS + 100));
    expect(screen.queryByText('Done reading your new mails')).not.toBeInTheDocument();
  });

  it('asks again every 5 seconds only while mails are read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    show(reading);
    await status();
    const asked = vi.mocked(api.getAIReading).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(5_100));
    expect(vi.mocked(api.getAIReading).mock.calls.length).toBeGreaterThan(asked);
    vi.mocked(api.getAIReading).mockResolvedValue(nothing);
    await act(() => vi.advanceTimersByTimeAsync(5_100));
    const stopped = vi.mocked(api.getAIReading).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(vi.mocked(api.getAIReading).mock.calls.length).toBe(stopped);
  });

  it('is one icon with the words on hover when the menu is collapsed', async () => {
    localStorage.setItem('career-companion-menu', 'collapsed');
    show(reading);
    expect(
      await screen.findByTitle('Reading your new mails · 12 of 50 done · about 4 min left'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'AI reading status' })).not.toBeInTheDocument();
  });
});

describe('the AI reading status on phones', () => {
  it('is one cell in the top bar that opens the status under it', async () => {
    setWidth(375);
    show(reading);
    const cell = await screen.findByRole('button', {
      name: 'AI reading status: Reading your new mails',
    });
    expect(screen.queryByRole('region', { name: 'AI reading status' })).not.toBeInTheDocument();
    fireEvent.click(cell);
    const panel = await screen.findByRole('dialog', { name: 'AI reading status' });
    expect(within(panel).getByText('12 of 50 done · about 4 min left')).toBeVisible();
    expect(within(panel).getByText('Job mails found · 1')).toBeVisible();
    expect(within(panel).queryByRole('button', { name: 'Minimize' })).not.toBeInTheDocument();
  });
});
