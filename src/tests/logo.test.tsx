// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AISettingsResponse } from '../contracts/ai';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: { getGmailStatus: vi.fn(), getAISettings: vi.fn(), getAIReading: vi.fn() },
  };
});

import { SignInBar } from '../components/auth/SignInBar';
import { Logo, Wordmark } from '../components/layout/Logo';
import { StartupScreen } from '../components/startup/StartupScreen';
import { routeTree } from '../routeTree.gen';

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
  usageToday: { day: '2026-10-25', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 250, resetsAt: '2026-10-26T00:00:00.000Z' },
  waitingEmails: 0,
  needsYourOk: { emails: 0, model: null, lastTriedAt: null, tries: 0 },
  consent: null,
  connections: [],
} satisfies AISettingsResponse;

let queryClient: QueryClient;
let desktopWidth: number;
const setWidth = (width: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
/** The number of shapes in a mark: the half sun and its list lines. */
const shapes = (svg: Element | null) =>
  svg?.querySelector('path')?.getAttribute('d')?.split('Z').filter(Boolean).length;

function showApp() {
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

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  desktopWidth = window.innerWidth;
  setWidth(1280);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ mode: 'prod' }))),
  );
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'a@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
  });
  vi.mocked(api.getAISettings).mockResolvedValue(settings);
  vi.mocked(api.getAIReading).mockResolvedValue({
    state: 'NONE',
    reason: null,
    provider: 'career-companion',
    model: null,
    notDone: 0,
    done: 0,
    total: 0,
    inLine: false,
    secondsLeft: null,
    resumesAt: null,
    steps: [],
    jobMails: { count: 0, newest: [] },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setWidth(desktopWidth);
});

describe('the mark', () => {
  it('draws three list lines from 24px and two thicker ones below', () => {
    const { container } = render(
      <>
        <Logo size={16} />
        <Logo size={24} />
      </>,
    );
    const [small, large] = container.querySelectorAll('svg');
    expect(shapes(small)).toBe(3);
    expect(shapes(large)).toBe(4);
    expect(small).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('the name', () => {
  it('reads "NorthList" and draws the mark as its "o", small under 28px', () => {
    const { container } = render(
      <>
        <Wordmark size={22} />
        <Wordmark size={28} />
      </>,
    );
    const [small, large] = screen.getAllByRole('img', { name: 'NorthList' });
    expect(small).toHaveTextContent('nrthlist');
    expect(small).toHaveStyle({ fontSize: '22px' });
    expect(shapes(small.querySelector('svg'))).toBe(3);
    expect(shapes(large.querySelector('svg'))).toBe(4);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });
});

describe('where the logo shows: the name, or the mark alone, never both', () => {
  it('shows the name in the top bar, and only the mark once the side menu is collapsed', async () => {
    showApp();
    const home = await screen.findByRole('link', { name: 'NorthList' });
    expect(home).toHaveAttribute('href', '/mails');
    expect(within(home).getByRole('img', { name: 'NorthList' })).toBeInTheDocument();
    expect(home.querySelectorAll('svg')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse menu' }));
    expect(within(home).queryByRole('img', { name: 'NorthList' })).not.toBeInTheDocument();
    expect(home.querySelectorAll('svg')).toHaveLength(1);
    expect(shapes(home.querySelector('svg'))).toBe(3);
    expect(home).toHaveAttribute('href', '/mails');
  });

  it('shows the name at the top of the phone menu', async () => {
    setWidth(390);
    showApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Open menu' }));
    const menu = await screen.findByRole('dialog', { name: 'Menu' });
    expect(within(menu).getByRole('img', { name: 'NorthList' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
  });

  it('shows the name in the sign-in pages’ top bar', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <SignInBar />
      </QueryClientProvider>,
    );
    const bar = screen.getByRole('banner');
    expect(within(bar).getByRole('img', { name: 'NorthList' })).toBeInTheDocument();
    expect(bar.querySelectorAll('svg')).toHaveLength(1);
  });

  it('shows the name on the start-up screen', () => {
    render(<StartupScreen stage="checking" waitedMs={0} onRetry={() => undefined} />);
    const status = screen.getByRole('status');
    expect(within(status).getByRole('img', { name: 'NorthList' })).toBeInTheDocument();
    expect(status.querySelectorAll('svg')).toHaveLength(1);
  });
});
