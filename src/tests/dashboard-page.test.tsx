// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AIReadingStatusResponse } from '../contracts/ai';
import { FREE_AI_CONSENT } from '../lib/freeAI';
import { chooseOption } from './choose';
import { dashboardFixture } from './dashboard-fixture';
import { makeAISettings } from './fixtures';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      getDashboard: vi.fn(),
      getGmailStatus: vi.fn(),
      getAIReading: vi.fn(),
      getAISettings: vi.fn(),
    },
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

/** The free AI reads the mail: nothing waits, nothing to set up. */
const ready = makeAISettings({
  configured: true,
  provider: 'career-companion',
  access: { ...makeAISettings().access, state: 'READY', reason: null, verified: true },
  waitingEmails: 0,
  connections: [
    {
      provider: 'career-companion',
      active: true,
      state: 'READY',
      reason: null,
      modelId: null,
      failure: null,
      models: null,
      verified: true,
      lastCheckedAt: null,
      consentCurrent: true,
    },
  ],
});
const noGmail = { ...connected, connected: false, status: null };

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
  vi.mocked(api.getAISettings).mockResolvedValue(ready);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
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
    expect(within(progress).getByRole('heading', { name: 'Over time' })).toBeInTheDocument();
    // Rates in plain words (owner, 21 Nov 2026): 12 of 34 is "About 1 in 3".
    expect(within(progress).getByText('got a reply').nextSibling).toHaveTextContent('About 1 in 3');
    expect(within(progress).getByText('usual wait for a reply').nextSibling).toHaveTextContent(
      '6 days',
    );
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

  it('fetches the page again from the refresh button, so nobody has to reload the app', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening)/ });
    const before = vi.mocked(api.getDashboard).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() =>
      expect(vi.mocked(api.getDashboard).mock.calls.length).toBeGreaterThan(before),
    );
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
          needsAction: { count: 0, waitingOverADay: 0, missed: 0 },
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
    expect(
      await screen.findByText('Rates show once you have sent 5 applications'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('1 of 3').length).toBeGreaterThan(0);
    expect(screen.queryByText('got a reply')).not.toBeInTheDocument();
    // The usual reply time is one line inside the card, not a lone tile.
    expect(screen.queryByText('usual wait for a reply')).not.toBeInTheDocument();
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
    const bars = tile('Applied').querySelectorAll('svg rect');
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

describe('the first run (owner, 15 Nov 2026)', () => {
  beforeEach(() => {
    vi.mocked(api.getGmailStatus).mockResolvedValue(noGmail);
    vi.mocked(api.getDashboard).mockResolvedValue(dashboardFixture({ dataStartsAt: null }));
    vi.mocked(api.getAISettings).mockResolvedValue(makeAISettings());
    vi.stubGlobal('location', { href: '' });
  });

  it('one tap connects Gmail with the free AI, and the line under it says so', async () => {
    renderPage();
    expect(
      await screen.findByText(/Your job mails are read by NorthList's free AI, through OpenRouter/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Gmail' }));
    expect(window.location.href).toBe(
      `/api/gmail/connect?returnTo=%2Fdashboard&freeAI=${encodeURIComponent(FREE_AI_CONSENT)}`,
    );
  });

  it('"What is sent" shows the free AI facts, read only', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'What is sent' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Who reads it')).toBeInTheDocument();
    expect(within(dialog).getByText(/OpenRouter, on NorthList's account/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('without the free AI, Gmail comes first and the AI page after it, as before', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(
      makeAISettings({ offeredProviders: ['openrouter'] }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect Gmail' }));
    expect(window.location.href).toBe('/api/gmail/connect');
    expect(sessionStorage.getItem('career-companion-gmail-connect')).toBe('started');
    expect(screen.queryByText(/read by NorthList's free AI/)).not.toBeInTheDocument();
  });

  it('while the first sync gets the mails, it says so instead of empty numbers', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({ ...connected, syncStatus: 'SYNCING' });
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    renderPage();
    expect(await screen.findByText('Getting your mails from Gmail')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Needs you now' })).not.toBeInTheDocument();
  });

  it('names the free AI while it reads the first mails', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue(connected);
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.getAIReading).mockResolvedValue({
      ...idle,
      state: 'READING',
      provider: 'career-companion',
      done: 12,
      total: 40,
      secondsLeft: 70,
    });
    const empty = dashboardFixture({ dataStartsAt: null });
    empty.mailbox = { ...empty.mailbox, jobMails: { total: 0, inPeriod: 0 } };
    vi.mocked(api.getDashboard).mockResolvedValue(empty);
    renderPage();
    expect(
      await screen.findByText(/12 of 40 done · about 2 min left · read by NorthList free AI/),
    ).toBeInTheDocument();
  });

  it('says on the Dashboard when mails wait because no AI is set up', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue(connected);
    vi.mocked(api.getDashboard).mockResolvedValue(dashboardFixture());
    renderPage();
    const line = await screen.findByRole('status', { name: 'AI status' });
    expect(within(line).getByText(/AI is not set up/)).toBeInTheDocument();
    expect(within(line).getByRole('link', { name: 'Set up AI' })).toHaveAttribute('href', '/ai');
  });
});

describe('Today on a phone (owner, 21 Nov 2026, mock `DASHBOARD-PHONE-mock/`)', () => {
  let desktopWidth = 0;
  const setWidth = (width: number) =>
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
  beforeEach(() => {
    desktopWidth = window.innerWidth;
    setWidth(375);
  });
  afterEach(() => setWidth(desktopWidth));

  it('is called Today, with the "Needs you" tiles, the five numbers and the charts', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    const needs = await screen.findByRole('region', { name: 'Needs you' });
    const tile = (name: string, count: string, line: string, href: string) => {
      const link = within(needs).getByRole('link', { name: new RegExp(`^${name}`) });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveTextContent(count);
      expect(within(link).getByText(new RegExp(line))).toBeInTheDocument();
    };
    tile('Needs action', '3', 'waiting over a day', '/mails?request=open');
    tile('New job mails', '5', 'not opened yet', '/mails?unseen=true');
    tile('Interviews coming up', '2', 'Next:', '/mails/thread-9');
    // Gone quiet left the phone (owner, 21 Nov 2026).
    expect(within(needs).queryByText('Gone quiet')).not.toBeInTheDocument();
    const progress = screen.getByRole('region', { name: 'Your progress' });
    for (const term of ['Applied', 'Replies', 'Interviews', 'Offers', 'Rejected'])
      expect(within(progress).getByText(term)).toBeInTheDocument();
    expect(within(progress).getByText('↑ 8')).toBeInTheDocument();
    expect(
      within(progress).getByText('Arrows compare with the 30 days before.'),
    ).toBeInTheDocument();
    // The charts are on Today itself; no "Charts and rates" page any more.
    expect(screen.getByRole('region', { name: 'Over time' })).toBeInTheDocument();
    const mailbox = screen.getByRole('region', { name: 'Your mailbox' });
    expect(within(mailbox).getByText('Mails checked')).toBeInTheDocument();
    expect(within(mailbox).getByRole('link', { name: /Not linked to a job/ })).toHaveAttribute(
      'href',
      '/mails?application=none',
    );
    expect(screen.getByRole('region', { name: 'Job mails per day' })).toBeInTheDocument();
    expect(screen.queryByText('From applied to offer')).not.toBeInTheDocument();
    expect(screen.queryByText('Acme Analytics')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What works best' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Charts and rates' })).not.toBeInTheDocument();
  });

  it('picks the period on Today, and everything under it follows', async () => {
    const router = renderPage();
    await chooseOption(await screen.findByRole('combobox', { name: 'Period' }), 'Last 7 days');
    await waitFor(() => expect(router.state.location.search).toEqual({ period: '7d' }));
    await waitFor(() =>
      expect(api.getDashboard).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: '7d' }),
        expect.anything(),
      ),
    );
    expect(await screen.findByText('Arrows compare with the 7 days before.')).toBeInTheDocument();
  });

  it('shows what works best as rows to NorthList Apply users', async () => {
    const used = dashboardFixture();
    used.automation = {
      ...used.automation,
      used: true,
      sent: 6,
      lookedAt: 9,
      sites: [{ platform: 'linkedin', sent: 6, answered: 2, interviews: 0 }],
      workModes: [{ workMode: 'remote', sent: 3, answered: 1 }],
    };
    vi.mocked(api.getDashboard).mockResolvedValue(used);
    renderPage();
    const best = await screen.findByRole('region', { name: 'What works best' });
    expect(within(best).getByText('1 in 3 replied')).toBeInTheDocument();
    expect(within(best).getByText('6 sent · No interview yet')).toBeInTheDocument();
    expect(within(best).getByText('Too few to tell')).toBeInTheDocument();
    expect(within(best).getByText('9 jobs looked at')).toBeInTheDocument();
  });

  it('sends the old charts address to Today, keeping the period', async () => {
    const router = renderPage('/dashboard/charts?period=90d');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(router.state.location.search).toEqual({ period: '90d' });
  });
});
