// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api, ApiError, ApiClient } from '../api/client';
import { routeTree } from '../routeTree.gen';
import type { ActionWithContextResponse, AISettingsResponse } from '../contracts';
import { workspacePage } from './fixtures';
import { coverageMessages, transitionDelay } from '../lib/workspace';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: {
    listApplications: vi.fn(),
    getAmbiguousEmails: vi.fn(),
    getUnmatchedEmails: vi.fn(),
    getPendingSubmissions: vi.fn(),
    getWorkspaceActions: vi.fn(),
    getWorkspaceReview: vi.fn(),
    updateAction: vi.fn(),
    getGmailStatus: vi.fn(),
    getAISettings: vi.fn(),
  },
}));
const makeAction = (
  overrides: Partial<ActionWithContextResponse> = {},
): ActionWithContextResponse => ({
  origin: null,
  actionRevision: 0,
  clientRequestId: null,
  snoozedUntil: null,
  id: 'action-1',
  applicationId: 'app-1',
  emailId: null,
  type: 'ACTION_REQUIRED',
  description: 'Submit assignment',
  deadline: null,
  deadlinePrecision: null,
  status: 'PENDING',
  createdAt: '2026-01-15T10:00:00.000Z',
  application: { companyName: 'Acme Corp', jobTitle: 'Senior Engineer' },
  email: null,
  ...overrides,
});
const empty = { items: [], metadata: { limit: 20, offset: 0, nextOffset: null } };
const ready: AISettingsResponse = {
  configured: true,
  provider: 'gemini',
  offeredProviders: [],
  models: null,
  access: {
    state: 'READY',
    reason: null,
    modelId: null,
    resumesAt: null,
    verified: true,
    lastCheckedAt: null,
  },
  usageToday: { day: '2026-10-03', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 30, resetsAt: '2026-10-04T00:00:00.000Z' },
  waitingEmails: 0,
  consent: null,
};
let client: QueryClient;
function show() {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 3, retryDelay: 0 } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { user: { id: 'u', email: 'u@fixture.test', name: 'U' } },
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listApplications).mockResolvedValue(empty);
  vi.mocked(api.getAmbiguousEmails).mockResolvedValue(empty);
  vi.mocked(api.getUnmatchedEmails).mockResolvedValue(empty);
  vi.mocked(api.getPendingSubmissions).mockResolvedValue(empty);
  vi.mocked(api.getWorkspaceActions).mockResolvedValue(workspacePage());
  vi.mocked(api.getWorkspaceReview).mockResolvedValue({
    generatedAt: new Date().toISOString(),
    unmatched: 2,
    ambiguous: 3,
    pendingSubmissions: 4,
  });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'u@fixture.test',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: new Date().toISOString(),
  });
  vi.mocked(api.getAISettings).mockResolvedValue(ready);
});
afterEach(() => {
  cleanup();
  client?.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('daily workspace', () => {
  it('shows full counts independently of a small page, DATE labels without time, and contextual links', async () => {
    vi.mocked(api.getWorkspaceActions).mockResolvedValue(
      workspacePage(
        [
          makeAction({
            deadline: '2026-10-03T00:00:00Z',
            deadlinePrecision: 'DATE',
            email: { threadId: 'thread-action', subject: 'Fixture mail', sender: null },
          }),
        ],
        {
          counts: { snoozed: 0, overdue: 25, today: 7, later: 8, undated: 7, totalPending: 47 },
        },
      ),
    );
    show();
    expect(await screen.findByRole('button', { name: 'All (47)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overdue (25)' })).toBeInTheDocument();
    expect(screen.getByText(/^Due:/)).not.toHaveTextContent(/AM|PM/);
    expect(screen.getByRole('link', { name: /Open email "Fixture mail"/ })).toHaveAttribute(
      'href',
      expect.stringContaining('thread-action'),
    );
    expect(screen.getByRole('link', { name: 'Unmatched emails (2)' })).toHaveAttribute(
      'href',
      '#unmatched-review',
    );
  });

  it('limits empty-state claims even when Gmail is recent, AI is ready and zero mail is waiting', async () => {
    show();
    expect(await screen.findByText('No stored pending actions.')).toBeInTheDocument();
    expect(screen.getByText(/Processing completeness is unknown/)).toBeInTheDocument();
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument();
  });

  it('makes failed coverage reads unknown and keeps action/review errors independent', async () => {
    vi.mocked(api.getGmailStatus).mockRejectedValue(new Error('failed'));
    vi.mocked(api.getWorkspaceReview).mockRejectedValue(new Error('failed'));
    show();
    expect(await screen.findByText('No stored pending actions.')).toBeInTheDocument();
    expect(await screen.findByText('Review counts are unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Gmail coverage is unknown.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Unmatched emails (0)' })).not.toBeInTheDocument();
  });

  it('resets pagination and ignores a late response for the previous bucket', async () => {
    let resolve!: (value: ReturnType<typeof workspacePage>) => void;
    vi.mocked(api.getWorkspaceActions).mockImplementation(async (params) => {
      if (params.bucket === 'today')
        return new Promise((res) => {
          resolve = res;
        });
      return workspacePage([makeAction({ description: params.bucket })], {
        metadata: { limit: 20, offset: params.offset, nextOffset: 20 },
      });
    });
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(api.getWorkspaceActions).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 20 }),
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /^Today/ }));
    await waitFor(() => expect(resolve).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /^Undated/ }));
    expect(await screen.findByText('undated')).toBeInTheDocument();
    await act(async () =>
      resolve(workspacePage([makeAction({ description: 'stale today result' })])),
    );
    expect(screen.queryByText('stale today result')).not.toBeInTheDocument();
    expect(api.getWorkspaceActions).toHaveBeenLastCalledWith(
      expect.objectContaining({ bucket: 'undated', offset: 0 }),
      expect.anything(),
    );
  });

  it.each(['Complete', 'Dismiss'])(
    'uses existing %s mutation once and refreshes counts',
    async (label) => {
      vi.mocked(api.getWorkspaceActions).mockResolvedValue(workspacePage([makeAction()]));
      vi.mocked(api.updateAction).mockImplementation(async () => {
        vi.mocked(api.getWorkspaceActions).mockResolvedValue(workspacePage());
        return makeAction({ status: label === 'Complete' ? 'COMPLETED' : 'DISMISSED' });
      });
      show();
      fireEvent.click(await screen.findByRole('button', { name: label }));
      expect(await screen.findByText('No stored pending actions.')).toBeInTheDocument();
      expect(api.updateAction).toHaveBeenCalledExactlyOnceWith('action-1', {
        expectedActionRevision: 0,
        status: label === 'Complete' ? 'COMPLETED' : 'DISMISSED',
      });
      expect(screen.getByRole('heading', { name: 'Action Center' })).toHaveFocus();
    },
  );

  it('reconciles a lost write response without replaying it', async () => {
    vi.mocked(api.getWorkspaceActions).mockResolvedValue(workspacePage([makeAction()]));
    vi.mocked(api.updateAction).mockRejectedValue(new ApiError('timeout', 'timeout'));
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Complete' }));
    expect(await screen.findByText(/action update could not be confirmed/)).toBeInTheDocument();
    await waitFor(() =>
      expect(vi.mocked(api.getWorkspaceActions).mock.calls.length).toBeGreaterThan(1),
    );
    expect(api.updateAction).toHaveBeenCalledTimes(1);
  });

  it('refreshes from an off-page transition while Undated is selected and clears the timer on unmount', async () => {
    const schedule = vi.spyOn(globalThis, 'setTimeout');
    const cancel = vi.spyOn(globalThis, 'clearTimeout');
    vi.mocked(api.getWorkspaceActions).mockResolvedValue(
      workspacePage([makeAction()], {
        generatedAt: new Date().toISOString(),
        nextTransitionAt: new Date(Date.now() + 30_000).toISOString(),
        counts: { snoozed: 0, overdue: 0, today: 1, later: 0, undated: 1, totalPending: 2 },
      }),
    );
    const view = show();
    fireEvent.click(await screen.findByRole('button', { name: 'Undated (1)' }));
    await waitFor(() =>
      expect(api.getWorkspaceActions).toHaveBeenLastCalledWith(
        expect.objectContaining({ bucket: 'undated' }),
        expect.anything(),
      ),
    );
    const timers = schedule.mock.calls
      .map((call, i) => ({ call, result: schedule.mock.results[i] }))
      .filter(({ call }) => call[1] === 60_000);
    expect(timers.length).toBeGreaterThan(0);
    const count = vi.mocked(api.getWorkspaceActions).mock.calls.length;
    await act(async () => {
      (timers[timers.length - 1].call[0] as () => void)();
    });
    await waitFor(() =>
      expect(vi.mocked(api.getWorkspaceActions).mock.calls.length).toBeGreaterThan(count),
    );
    view.unmount();
    expect(cancel).toHaveBeenCalledWith(timers[timers.length - 1].result.value);
  });

  it('refreshes after focus and exposes useful controls in the coverage section', async () => {
    show();
    await screen.findByText('No stored pending actions.');
    const calls = vi.mocked(api.getWorkspaceActions).mock.calls.length;
    fireEvent(window, new Event('focus'));
    await waitFor(() =>
      expect(vi.mocked(api.getWorkspaceActions).mock.calls.length).toBeGreaterThan(calls),
    );
    const coverage = screen.getByRole('region', { name: 'Input coverage' });
    expect(within(coverage).getByRole('link', { name: 'Gmail and processing' })).toHaveAttribute(
      'href',
      '/gmail',
    );
  });
});

it('reports disconnected, never-synced, failed and gap-limited coverage without inventing a freshness threshold', () => {
  const copy = coverageMessages({
    connected: false,
    gmailEmail: null,
    status: 'REVOKED',
    syncStatus: 'FAILED',
    lastSyncedAt: null,
    unscannedGap: { from: '2026-01-01T00:00:00Z', until: '2026-02-01T00:00:00Z' },
  }).join(' ');
  expect(copy).toMatch(/disconnected/);
  expect(copy).toMatch(/No successful/);
  expect(copy).toMatch(/could not finish/);
  expect(copy).toMatch(/not scanned/);
  expect(copy).toMatch(/unknown/);
  expect(
    transitionDelay(
      { generatedAt: '2026-10-03T00:00:00Z', nextTransitionAt: '2026-10-03T00:02:00Z' },
      10_000,
    ),
  ).toBe(110_000);
});
it('runtime-validates workspace and Gmail coverage responses', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ connected: true }), { status: 200 })),
  );
  await expect(new ApiClient().getGmailStatus()).rejects.toMatchObject({ kind: 'contract' });
  await expect(
    new ApiClient().getWorkspaceActions({ bucket: 'all', timeZone: 'UTC', limit: 20, offset: 0 }),
  ).rejects.toMatchObject({ kind: 'contract' });
});
