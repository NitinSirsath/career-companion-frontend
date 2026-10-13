// @vitest-environment jsdom
import { workspacePage } from './fixtures';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { AISettingsResponse } from '../contracts/ai';
import type { EmailMessage } from '../contracts/gmail';
import { getProcessingRefreshUntil, resetProcessingRefresh } from '../lib/processingRefresh';
import { makeApplication, makeEvent } from './fixtures';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      getGmailStatus: vi.fn(),
      getMessages: vi.fn(),
      retryEmail: vi.fn(),
      triggerSync: vi.fn(),
      disconnectGmail: vi.fn(),
      getAISettings: vi.fn(),
      readWaitingMail: vi.fn(),
      listApplications: vi.fn(),
      getActions: vi.fn(),
      getWorkspaceActions: vi.fn(),
      getWorkspaceReview: vi.fn(),
      getAmbiguousEmails: vi.fn(),
      getUnmatchedEmails: vi.fn(),
      getPendingSubmissions: vi.fn(),
      getApplication: vi.fn(),
      getApplicationEvents: vi.fn(),
      getApplicationActions: vi.fn(),
    },
  };
});

import { routeTree } from '../routeTree.gen';

const empty = { items: [], metadata: { limit: 20, offset: 0, nextOffset: null } };
const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });
const settings = (
  access: Partial<AISettingsResponse['access']>,
  extra: Partial<AISettingsResponse> = {},
): AISettingsResponse => ({
  configured: true,
  provider: 'gemini',
  offeredProviders: ['gemini'],
  models: {
    fast: { id: 'gemini-2.5-flash-lite', source: 'RECOMMENDED' },
    detailed: { id: 'gemini-2.5-flash', source: 'RECOMMENDED' },
  },
  access: {
    state: 'READY',
    reason: null,
    modelId: null,
    resumesAt: null,
    verified: true,
    lastCheckedAt: null,
    ...access,
  },
  usageToday: { day: '2026-10-02', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 500, resetsAt: '2026-10-03T00:00:00.000Z' },
  waitingEmails: 0,
  consent: null,
  ...extra,
});
const notSetUp = settings(
  { state: 'NOT_SET_UP', reason: 'NOT_SET_UP', verified: false },
  { configured: false, provider: null, models: null, waitingEmails: 4 },
);
const message = (overrides: Partial<EmailMessage>): EmailMessage => ({
  id: 'email-1',
  gmailMessageId: 'm',
  threadId: null,
  subject: 'Interview invite',
  sender: 'hr@example.com',
  receivedAt: null,
  relevanceState: 'UNPROCESSED',
  matchState: 'UNMATCHED',
  processingState: 'PENDING',
  ...overrides,
});

let queryClient: QueryClient;
function show(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: { id: 'u', email: 'u@example.com', name: 'U' } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetProcessingRefresh();
  vi.mocked(api.getWorkspaceActions).mockResolvedValue(workspacePage());
  vi.mocked(api.getWorkspaceReview).mockResolvedValue({
    generatedAt: new Date().toISOString(),
    unmatched: 0,
    ambiguous: 0,
    pendingSubmissions: 0,
  });
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'u@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
  });
  vi.mocked(api.getAISettings).mockResolvedValue(settings({}));
  vi.mocked(api.listApplications).mockResolvedValue(empty);
  vi.mocked(api.getActions).mockResolvedValue(empty);
  vi.mocked(api.getAmbiguousEmails).mockResolvedValue(empty);
  vi.mocked(api.getUnmatchedEmails).mockResolvedValue(empty);
  vi.mocked(api.getPendingSubmissions).mockResolvedValue(empty);
  vi.mocked(api.getMessages).mockResolvedValue(page([]));
});
afterEach(() => vi.useRealTimers());

describe('AI access notice', () => {
  it('tells a user without AI how many emails wait and where to set it up', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(notSetUp);
    show('/');
    const notice = await screen.findByRole('status', { name: 'AI status' });
    expect(notice).toHaveTextContent('AI is not set up');
    expect(notice).toHaveTextContent('4 emails are waiting');
    expect(within(notice).getByRole('link', { name: 'Set up AI' })).toHaveAttribute('href', '/ai');
  });

  it('is hidden while AI is ready', async () => {
    show('/');
    await waitFor(() => expect(api.getAISettings).toHaveBeenCalled());
    expect(screen.queryByRole('status', { name: 'AI status' })).not.toBeInTheDocument();
  });

  it('shows the provider fix for a billing problem on the Gmail page', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(
      settings({ state: 'NEEDS_ATTENTION', reason: 'ACCOUNT_OR_BILLING' }),
    );
    show('/gmail');
    const notice = await screen.findByRole('status', { name: 'AI status' });
    expect(
      within(notice).getByRole('link', { name: 'Open Google Gemini billing' }),
    ).toHaveAttribute('href', 'https://ai.google.dev/gemini-api/docs/billing');
  });
});

describe('Read waiting mails now', () => {
  const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
  const busy = (resumesAt: string, waitingEmails = 1) =>
    settings({ state: 'LIMITED', reason: 'PROVIDER_BUSY', resumesAt }, { waitingEmails });
  const readyWith = (waitingEmails: number) => settings({}, { waitingEmails });
  const notice = () => screen.findByRole('status', { name: 'AI status' });
  const button = () => screen.findByRole('button', { name: 'Read waiting mails now' });

  it('is offered while mail waits for a busy provider', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(busy(inMinutes(10)));
    show('/gmail');
    expect(await notice()).toHaveTextContent('Google Gemini is busy right now');
    expect(await notice()).toHaveTextContent(
      'Reading continues by itself then. 1 email is waiting.',
    );
    expect(await button()).toBeEnabled();
  });

  it.each([
    ['a key problem', { state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }],
    ['the daily safety limit', { state: 'LIMITED', reason: 'SAFETY_LIMIT' }],
  ] as const)('is not offered for %s', async (_label, access) => {
    vi.mocked(api.getAISettings).mockResolvedValue(settings(access, { waitingEmails: 1 }));
    show('/gmail');
    await notice();
    expect(screen.queryByRole('button', { name: 'Read waiting mails now' })).toBeNull();
  });

  it('starts a new try, says so, and says when the provider is still busy', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(busy(inMinutes(10)));
    vi.mocked(api.readWaitingMail).mockResolvedValue(readyWith(1));
    show('/gmail');
    const start = await button();
    // The try ended the pause: reloads now show AI as ready, with the mail still waiting.
    vi.mocked(api.getAISettings).mockResolvedValue(readyWith(1));
    fireEvent.click(start);
    await waitFor(() => expect(api.readWaitingMail).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Trying again now. 1 email is waiting.')).toBeInTheDocument();
    expect(await notice()).toHaveTextContent('Google Gemini is busy right now');
    expect(screen.getByRole('button', { name: 'Trying now…' })).toBeDisabled();
    expect(getProcessingRefreshUntil()).toBeGreaterThan(Date.now());

    // Google answers the new try with another pause.
    vi.mocked(api.getAISettings).mockResolvedValue(busy(inMinutes(12)));
    await act(() => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }));
    expect(await screen.findByText('Google Gemini is still busy')).toBeInTheDocument();
    expect(await notice()).toHaveTextContent(/Tried at \d{1,2}:\d{2} [AP]M\. Paused until about/);
    expect(await button()).toBeEnabled();
  });

  it('hides the notice once the waiting mail was read', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(busy(inMinutes(10)));
    vi.mocked(api.readWaitingMail).mockResolvedValue(readyWith(1));
    show('/gmail');
    const start = await button();
    vi.mocked(api.getAISettings).mockResolvedValue(readyWith(0));
    fireEvent.click(start);
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'AI status' })).not.toBeInTheDocument(),
    );
    // A later pause is a new story, not an answer to the old try.
    vi.mocked(api.getAISettings).mockResolvedValue(busy(inMinutes(30)));
    await act(() => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }));
    expect(await screen.findByText('Google Gemini is busy right now')).toBeInTheDocument();
    expect(screen.queryByText(/Tried at/)).toBeNull();
  });

  it('says so when the new try could not be started, and offers it again', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(busy(inMinutes(10)));
    vi.mocked(api.readWaitingMail).mockRejectedValue(new Error('network'));
    show('/gmail');
    fireEvent.click(await button());
    expect(
      await screen.findByText('The new try could not be started. Try again.'),
    ).toBeInTheDocument();
    expect(await button()).toBeEnabled();
  });

  it('looks again by itself just after the pause ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.getAISettings).mockResolvedValue(
      busy(new Date(Date.now() + 20_000).toISOString()),
    );
    show('/gmail');
    await button();
    expect(getProcessingRefreshUntil()).toBe(0);
    vi.mocked(api.getAISettings).mockResolvedValue(readyWith(1));
    await act(() => vi.advanceTimersByTimeAsync(26_000));
    expect(getProcessingRefreshUntil()).toBeGreaterThan(Date.now());
    expect(await screen.findByText('Trying again now. 1 email is waiting.')).toBeInTheDocument();
    expect(api.readWaitingMail).not.toHaveBeenCalled();
  });
});

describe('Gmail table while waiting for AI', () => {
  it('labels pending mail as waiting for AI and does not poll for it', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(notSetUp);
    vi.mocked(api.getMessages).mockResolvedValue(page([message({})]));
    show('/gmail');
    expect(await screen.findByText('Waiting for AI')).toBeInTheDocument();
    const calls = vi.mocked(api.getMessages).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 2600));
    expect(vi.mocked(api.getMessages).mock.calls.length).toBe(calls);
  });

  it('shows which provider and model analyzed a completed email', async () => {
    vi.mocked(api.getMessages).mockResolvedValue(
      page([
        message({
          processingState: 'COMPLETED',
          aiProcessingResult: { provider: 'gemini', model: 'gemini-2.5-flash' },
        }),
        message({
          id: 'email-2',
          subject: 'Sale',
          processingState: 'COMPLETED',
          aiProcessingResult: { provider: 'deterministic', model: 'none' },
        }),
      ]),
    );
    show('/gmail');
    expect(
      await screen.findByText('Analyzed by Google Gemini · Gemini 2.5 Flash'),
    ).toBeInTheDocument();
    expect(screen.getByText('Filtered by rules (no AI)')).toBeInTheDocument();
  });
});

describe('Retry anyway (user-approved retry)', () => {
  const approvalNeeded = new ApiError('approve', 'http', 409, 'AI_RETRY_NEEDS_APPROVAL', {
    operations: [
      {
        operation: 'extraction',
        reason: 'OUTCOME_UNKNOWN',
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        attemptedAt: '2026-10-01T10:00:00.000Z',
      },
    ],
    currentProvider: 'gemini',
  });

  async function clickManualRetry() {
    vi.mocked(api.getMessages).mockResolvedValue(
      page([
        message({
          processingState: 'FAILED',
          processingErrorCategory: 'OutcomeUnknown',
          processingErrorDetails: 'AI provider outcome unknown; reconciliation required',
          processingRetryable: false,
        }),
      ]),
    );
    show('/gmail');
    await screen.findByText('Interview invite');
    const trigger = document.querySelector('.cursor-help') as HTMLElement;
    fireEvent.mouseEnter(trigger);
    fireEvent.pointerEnter(trigger);
    fireEvent.focus(trigger);
    expect(await screen.findByText('Outcome unknown')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /Manual Retry/ }));
  }

  it('asks before one more call, explaining the possible extra charge, then sends the approval', async () => {
    vi.mocked(api.retryEmail)
      .mockRejectedValueOnce(approvalNeeded)
      .mockResolvedValueOnce({ success: true });
    await clickManualRetry();
    expect(await screen.findByText('Retry with a possible extra charge?')).toBeInTheDocument();
    expect(
      screen.getByText(/Detail extraction was sent to Google Gemini · Gemini 2.5 Flash/),
    ).toHaveTextContent('may already have been processed and charged');
    expect(screen.getByText(/may be charged again/)).toBeInTheDocument();
    expect(api.retryEmail).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry anyway' }));
    await waitFor(() =>
      expect(api.retryEmail).toHaveBeenLastCalledWith('email-1', {
        acceptPossibleDuplicateCharge: true,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('Retry with a possible extra charge?')).not.toBeInTheDocument(),
    );
  });

  it('sends nothing more when the user cancels', async () => {
    vi.mocked(api.retryEmail).mockRejectedValueOnce(approvalNeeded);
    await clickManualRetry();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.queryByText('Retry with a possible extra charge?')).not.toBeInTheDocument(),
    );
    expect(api.retryEmail).toHaveBeenCalledTimes(1);
  });

  it('names the new provider when the user switched since the earlier attempt', async () => {
    vi.mocked(api.retryEmail).mockRejectedValueOnce(
      new ApiError('approve', 'http', 409, 'AI_RETRY_NEEDS_APPROVAL', {
        operations: [
          {
            operation: 'classification',
            reason: 'INVALID_OUTPUT',
            provider: 'openai',
            model: 'gpt-x',
            attemptedAt: null,
          },
        ],
        currentProvider: 'gemini',
      }),
    );
    await clickManualRetry();
    expect(
      await screen.findByText(/This retry uses Google Gemini, not the provider used before/),
    ).toBeInTheDocument();
  });

  it('never resends when the approval outcome is uncertain', async () => {
    vi.mocked(api.retryEmail)
      .mockRejectedValueOnce(approvalNeeded)
      .mockRejectedValueOnce(new ApiError('timed out', 'timeout'));
    await clickManualRetry();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry anyway' }));
    expect(await screen.findByText(/Retry could not be confirmed/)).toBeInTheDocument();
    expect(api.retryEmail).toHaveBeenCalledTimes(2);
  });

  it('gives definitive refusals their own message', async () => {
    vi.mocked(api.retryEmail).mockRejectedValueOnce(
      new ApiError('review', 'http', 409, 'AI_OPERATION_REQUIRES_REVIEW'),
    );
    await clickManualRetry();
    expect(
      await screen.findByText(
        'This email needs review by Career Companion before it can be retried.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/could not be confirmed/)).not.toBeInTheDocument();
  });
});

describe('provenance on the application timeline', () => {
  it('labels an AI interpretation with the provider and model that produced it', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(
      makeApplication({ id: 'app-1', companyName: 'Northwind' }),
    );
    vi.mocked(api.getApplicationActions).mockResolvedValue(empty);
    vi.mocked(api.getApplicationEvents).mockResolvedValue(
      page([
        makeEvent({
          description: 'Interview scheduled',
          analyzedBy: { provider: 'gemini', model: 'gemini-2.5-flash' },
        }),
      ]),
    );
    show('/applications/app-1');
    expect(
      await screen.findByText('Analyzed by Google Gemini · Gemini 2.5 Flash'),
    ).toBeInTheDocument();
  });
});

describe('stopped email recovery', () => {
  it.each([null, 'Provider temporarily unavailable'])(
    'offers visible retry for a stopped row with details %s',
    async (processingErrorDetails) => {
      vi.mocked(api.getMessages).mockResolvedValue(
        page([
          message({ processingState: 'PROCESSING', processingStuck: true, processingErrorDetails }),
        ]),
      );
      vi.mocked(api.retryEmail).mockResolvedValue({ success: true });
      show('/gmail');
      expect(await screen.findByText('Stopped')).toBeInTheDocument();
      expect(screen.getByText(/Processing stopped before it finished/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Manual Retry' }));
      await waitFor(() => expect(api.retryEmail).toHaveBeenCalledTimes(1));
    },
  );

  it.each([true, undefined])(
    'does not poll outside the window when stuck is %s',
    async (processingStuck) => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(api.getMessages).mockResolvedValue(
        page([message({ processingState: 'PROCESSING', processingStuck })]),
      );
      show('/gmail');
      await screen.findByText('Interview invite');
      const count = vi.mocked(api.getMessages).mock.calls.length;
      await act(() => vi.advanceTimersByTimeAsync(90000));
      expect(vi.mocked(api.getMessages).mock.calls.length).toBe(count);
    },
  );

  it('polls live processing at 15 seconds and stops when the server marks it stuck', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.getMessages).mockResolvedValue(
      page([
        message({
          processingState: 'PROCESSING',
          processingStuck: false,
          processingRetryable: true,
        }),
      ]),
    );
    show('/gmail');
    await screen.findByText('Retry scheduled');
    const count = vi.mocked(api.getMessages).mock.calls.length;
    vi.mocked(api.getMessages).mockResolvedValue(
      page([message({ processingState: 'PROCESSING', processingStuck: true })]),
    );
    await act(() => vi.advanceTimersByTimeAsync(16000));
    expect(screen.getByText('Stopped')).toBeInTheDocument();
    expect(vi.mocked(api.getMessages).mock.calls.length).toBe(count + 1);
    await act(() => vi.advanceTimersByTimeAsync(90000));
    expect(vi.mocked(api.getMessages).mock.calls.length).toBe(count + 1);
  });
});
