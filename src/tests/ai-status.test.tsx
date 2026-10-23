// @vitest-environment jsdom
import { workspacePage } from './fixtures';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { AIFailure, AIModelPause, AISettingsResponse } from '../contracts/ai';
import type { EmailAIStatus } from '../contracts/email';
import type { EmailMessage } from '../contracts/gmail';
import { clock } from '../lib/aiLabels';
import { resetProcessingRefresh } from '../lib/processingRefresh';
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
    failure: null,
    pauses: [],
    verified: true,
    lastCheckedAt: null,
    ...access,
  },
  lastFailure: null,
  usageToday: { day: '2026-10-02', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 500, resetsAt: '2026-10-03T00:00:00.000Z' },
  waitingEmails: 0,
  needsYourOk: { emails: 0, model: null, lastTriedAt: null, tries: 0 },
  consent: null,
  connections: [],
  ...extra,
});
const notSetUp = settings(
  { state: 'NOT_SET_UP', reason: 'NOT_SET_UP', verified: false },
  { configured: false, provider: null, models: null, waitingEmails: 4 },
);
const aiStatus = (overrides: Partial<EmailAIStatus> = {}): EmailAIStatus => ({
  reason: 'PROVIDER_BUSY',
  step: 'extraction',
  provider: 'gemini',
  model: 'gemini-3.8-flash',
  failure: null,
  attempts: 0,
  maxAttempts: 3,
  triedAt: [],
  nextTryAt: null,
  nextStep: 'AUTOMATIC_RETRY',
  readNowTest: null,
  ...overrides,
});
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

describe('the banner on Mails and Gmail Sync', () => {
  it.each(['/gmail', '/mails'])(
    'on %s names the model, the code and the next try, as on the mock (screen 1)',
    async (path) => {
      const failure: AIFailure = {
        kind: 'PROVIDER_BUSY',
        cause: 'PROVIDER_ANSWER',
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        httpStatus: 503,
        providerCode: 'UNAVAILABLE',
        quotaScope: null,
        freeTier: false,
        networkCode: null,
        stopReason: null,
        at: new Date().toISOString(),
        waitedMs: 3_000,
        timeoutMs: 60_000,
        attempt: null,
        maxAttempts: null,
      };
      const resumesAt = new Date(Date.now() + 2 * 60_000).toISOString();
      const pause = { model: failure.model, roles: ['detailed' as const] };
      vi.mocked(api.getAISettings).mockResolvedValue(
        settings(
          {
            state: 'LIMITED',
            reason: 'PROVIDER_BUSY',
            modelId: failure.model,
            resumesAt,
            failure,
            pauses: [{ ...pause, reason: 'PROVIDER_BUSY', resumesAt, failure, test: null }],
          },
          { waitingEmails: 1 },
        ),
      );
      show(path);
      const banner = await screen.findByRole('status', { name: 'AI status' });
      expect(banner).toHaveTextContent('Gemini 3.8 Flash is busy right now');
      expect(banner).toHaveTextContent(
        /Google answered 503 UNAVAILABLE at \d{1,2}:\d{2} [AP]M\. Career Companion tries again by itself at about \d{1,2}:\d{2} [AP]M\. 1 email is waiting\./,
      );
      expect(within(banner).getByRole('button', { name: 'Read waiting mails now' })).toBeEnabled();
      expect(banner).toHaveTextContent('Sends 1 mail first, as a test.');
    },
  );
});

describe('Gmail table while waiting for AI', () => {
  it('labels pending mail as waiting for AI and does not poll for it', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(notSetUp);
    vi.mocked(api.getMessages).mockResolvedValue(
      page([
        message({
          aiStatus: aiStatus({ reason: 'NOT_SET_UP', model: null, nextStep: 'FIX_AI_SETTINGS' }),
        }),
      ]),
    );
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

describe('Gmail Sync row badges and the (i)', () => {
  it("takes the badge from the mail's own status, also when only one model is paused", async () => {
    vi.mocked(api.getMessages).mockResolvedValue(
      page([
        message({
          aiStatus: aiStatus({
            failure: {
              kind: 'PROVIDER_BUSY',
              cause: 'PROVIDER_ANSWER',
              provider: 'gemini',
              model: 'gemini-3.8-flash',
              httpStatus: 503,
              providerCode: 'UNAVAILABLE',
              quotaScope: null,
              freeTier: false,
              networkCode: null,
              stopReason: null,
              at: '2026-10-14T06:06:03.000Z',
              waitedMs: 3_000,
              timeoutMs: 60_000,
              attempt: null,
              maxAttempts: null,
            },
            nextTryAt: '2026-10-14T06:08:00.000Z',
          }),
        }),
        message({ id: 'email-2', subject: 'In line', aiStatus: null }),
      ]),
    );
    show('/gmail');
    // AI access is ready: only the model this mail needs is paused.
    expect(await screen.findByText('Waiting for AI')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    // A tap opens the (i), for phones.
    const why = screen.getByRole('button', { name: 'Why is this mail waiting?' });
    fireEvent.click(why);
    expect(await screen.findByText('Gemini 3.8 Flash was busy')).toBeInTheDocument();
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText(/^Google answered 503 UNAVAILABLE at .+, after 3 seconds\. /),
    ).toBeInTheDocument();
    expect(screen.getByText('Reading the details')).toBeInTheDocument();
    expect(screen.getByText(/^about .+, by itself$/)).toBeInTheDocument();
  });

  it('keeps the (i) open after a click, also after hover opened it, until a second click, Escape or a click outside', async () => {
    vi.mocked(api.getMessages).mockResolvedValue(page([message({ aiStatus: aiStatus() })]));
    show('/gmail');
    const why = await screen.findByRole('button', { name: 'Why is this mail waiting?' });
    const title = 'Gemini 3.8 Flash is busy right now';
    // Hover opens it, and the click that follows keeps it open, also when the mouse leaves.
    fireEvent.mouseEnter(why);
    fireEvent.mouseMove(why, { movementX: 5 });
    await waitFor(() => expect(why).toHaveAttribute('aria-expanded', 'true'), { timeout: 2_000 });
    fireEvent.click(why);
    fireEvent.mouseLeave(why);
    fireEvent.blur(why);
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(title)).toBeInTheDocument();
    // A second click closes it.
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'false');
    // Escape closes it.
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    // A click outside closes it.
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);
    expect(why).toHaveAttribute('aria-expanded', 'false');
  });

  it("shows a stopped mail as waiting for AI right after the user's OK", async () => {
    vi.mocked(api.getMessages).mockResolvedValue(
      page([
        message({
          processingState: 'FAILED',
          aiStatus: aiStatus({
            reason: 'NO_ANSWER_IN_TIME',
            attempts: 3,
            maxAttempts: 4,
            nextTryAt: null,
            nextStep: 'AUTOMATIC_RETRY',
          }),
        }),
      ]),
    );
    show('/gmail');
    expect(await screen.findByText('Waiting for AI')).toBeInTheDocument();
    expect(screen.queryByText('AI could not read it')).toBeNull();
    expect(screen.queryByRole('button', { name: /Manual Retry/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Why is this mail waiting?' }));
    expect(await screen.findByText('Gemini 3.8 Flash is tried once more')).toBeInTheDocument();
    expect(
      screen.getByText('You said OK. Career Companion tries it again in a moment.'),
    ).toBeInTheDocument();
  });

  it("words a mail that only waits behind a model's daily limit from that pause", async () => {
    const daily = {
      kind: 'RATE_LIMITED' as const,
      cause: 'PROVIDER_ANSWER' as const,
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      httpStatus: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      quotaScope: 'PER_DAY' as const,
      freeTier: true,
      networkCode: null,
      stopReason: null,
      at: '2026-10-14T09:40:00.000Z',
      waitedMs: 1_000,
      timeoutMs: 60_000,
      attempt: null,
      maxAttempts: null,
    };
    const resumesAt = '2026-10-15T07:00:00.000Z';
    vi.mocked(api.getAISettings).mockResolvedValue(
      settings({
        state: 'LIMITED',
        reason: 'RATE_LIMITED',
        modelId: 'gemini-3.8-flash',
        resumesAt,
        failure: daily,
        pauses: [
          {
            model: 'gemini-3.8-flash',
            roles: ['detailed'],
            reason: 'RATE_LIMITED',
            resumesAt,
            failure: daily,
            test: null,
          },
        ],
      }),
    );
    vi.mocked(api.getMessages).mockResolvedValue(
      page([message({ aiStatus: aiStatus({ reason: 'RATE_LIMITED', nextTryAt: resumesAt }) })]),
    );
    show('/gmail');
    fireEvent.click(await screen.findByRole('button', { name: 'Why is this mail waiting?' }));
    expect(
      await screen.findByText(
        'The free-tier daily limit for Gemini 3.8 Flash. This does not use one of the 3 tries.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the test mail wait, the OK a mail needs, and a refused request in plain words', async () => {
    vi.mocked(api.getMessages).mockResolvedValue(
      page([
        message({
          aiStatus: aiStatus({
            nextStep: 'WAITS_FOR_TEST_MAIL',
            readNowTest: 'WAITS_FOR_TEST_MAIL',
          }),
        }),
        message({
          id: 'email-2',
          processingState: 'FAILED',
          processingErrorCategory: 'OutcomeUnknown',
          processingErrorDetails: 'AI provider outcome unknown; reconciliation required',
          processingErrorStage: 'extraction',
          aiStatus: aiStatus({
            reason: 'NO_ANSWER_IN_TIME',
            attempts: 3,
            nextStep: 'RETRY_WITH_YOUR_OK',
          }),
        }),
        message({
          id: 'email-3',
          processingState: 'FAILED',
          processingErrorDetails: 'Request rejected by provider',
          aiStatus: aiStatus({ reason: 'INVALID_REQUEST', nextStep: 'CAREER_COMPANION' }),
        }),
      ]),
    );
    show('/gmail');
    expect(await screen.findByText('Not sent yet: waits for the test mail.')).toBeInTheDocument();
    expect(screen.getByText('Needs your OK')).toBeInTheDocument();
    expect(screen.getByText('AI could not read it')).toBeInTheDocument();
    expect(screen.queryByText('FAILED')).toBeNull();
    // Only the mail that waits for the user's OK offers Manual Retry.
    expect(screen.getAllByRole('button', { name: 'Manual Retry' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Why does this mail need my OK?' }));
    expect(await screen.findByText('Gemini 3.8 Flash did not answer 3 times')).toBeInTheDocument();
    expect(screen.getByText('waits for you. Use Manual Retry.')).toBeInTheDocument();
    expect(screen.queryByText(/reconciliation|Outcome unknown|Stage:/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Why could the AI not read this mail?' }));
    expect(await screen.findByText('Request refused')).toBeInTheDocument();
    expect(screen.getByText('waits for Career Companion.')).toBeInTheDocument();
  });
});

describe('Retry anyway (user-approved retry)', () => {
  /** Today at this local time, so the clock shows the time only. */
  const today = (hours: number, minutes: number) => {
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  };
  const approvalNeeded = new ApiError('approve', 'http', 409, 'AI_RETRY_NEEDS_APPROVAL', {
    operations: [
      {
        operation: 'extraction',
        reason: 'ATTEMPTS_EXHAUSTED',
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        attemptedAt: today(11, 44),
        triedAt: [today(11, 37), today(11, 40), today(11, 44)],
        failure: {
          kind: 'NO_ANSWER_IN_TIME',
          cause: 'TIMEOUT',
          provider: 'gemini',
          model: 'gemini-3.8-flash',
          httpStatus: null,
          providerCode: null,
          quotaScope: null,
          freeTier: false,
          networkCode: null,
          stopReason: null,
          at: today(11, 45),
          waitedMs: 75_000,
          timeoutMs: 60_000,
          attempt: 3,
          maxAttempts: 3,
        },
      },
    ],
    currentProvider: 'gemini',
  });
  /** The mail that needs the user's OK, as the list shows it before the retry. */
  const needsOk = message({
    processingState: 'FAILED',
    processingErrorCategory: 'OutcomeUnknown',
    processingErrorDetails: 'AI provider outcome unknown; reconciliation required',
    processingRetryable: false,
    aiStatus: aiStatus({
      reason: 'NO_ANSWER_IN_TIME',
      model: 'gemini-2.5-flash',
      attempts: 1,
      nextStep: 'RETRY_WITH_YOUR_OK',
    }),
  });

  async function clickManualRetry() {
    vi.mocked(api.getMessages).mockResolvedValue(page([needsOk]));
    show('/gmail');
    await screen.findByText('Interview invite');
    fireEvent.click(screen.getByRole('button', { name: 'Why does this mail need my OK?' }));
    expect(await screen.findByText('Gemini 2.5 Flash did not answer in time')).toBeInTheDocument();
    expect(screen.queryByText(/reconciliation/)).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /Manual Retry/ }));
  }

  it('asks before one more call, saying what happened as on the mock (screen 5), then sends the approval', async () => {
    vi.mocked(api.retryEmail)
      .mockRejectedValueOnce(approvalNeeded)
      .mockResolvedValueOnce({ success: true });
    await clickManualRetry();
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Retry with a possible extra charge?')).toBeInTheDocument();
    expect(within(dialog).getByRole('listitem')).toHaveTextContent(
      'Reading the details was sent to Google Gemini · Gemini 3.8 Flash 3 times, at 11:37, 11:40 and 11:44 AM. Each time there was no answer within 60 seconds, so Google may have charged for these tries.',
    );
    expect(
      within(dialog).getByText(
        'Career Companion already tried 3 times and will not try again on its own. Retrying makes one more AI call on your Google Gemini account, which may be charged.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/never retries/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
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
            triedAt: [],
            failure: null,
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
        'Only Career Companion can retry this email. This is our problem, not yours.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/could not be confirmed/)).not.toBeInTheDocument();
  });

  it('words a refused request as its row does, once the list shows it', async () => {
    vi.mocked(api.retryEmail).mockRejectedValueOnce(
      new ApiError('review', 'http', 409, 'AI_OPERATION_REQUIRES_REVIEW'),
    );
    await clickManualRetry();
    // The refreshed list shows the request Google refused.
    vi.mocked(api.getMessages).mockResolvedValue(
      page([
        message({
          processingState: 'FAILED',
          aiStatus: aiStatus({
            reason: 'INVALID_REQUEST',
            failure: {
              kind: 'INVALID_REQUEST',
              cause: 'PROVIDER_ANSWER',
              provider: 'gemini',
              model: 'gemini-2.5-flash',
              httpStatus: 400,
              providerCode: 'INVALID_ARGUMENT',
              quotaScope: null,
              freeTier: false,
              networkCode: null,
              stopReason: null,
              at: '2026-10-14T06:06:03.000Z',
              waitedMs: 1_000,
              timeoutMs: 60_000,
              attempt: null,
              maxAttempts: null,
            },
            nextStep: 'CAREER_COMPANION',
          }),
        }),
      ]),
    );
    await act(() => queryClient.invalidateQueries({ queryKey: ['gmailMessages'] }));
    expect(
      await screen.findByText(
        'Request refused. Career Companion sent a request Google refused (400 INVALID_ARGUMENT). This is our problem, not yours.',
      ),
    ).toBeInTheDocument();
  });

  /** A running pause of one model, for the roles that use it now. */
  const paused = (model: string, roles: AIModelPause['roles'], resumesAt: string) =>
    settings({
      state: 'LIMITED',
      reason: 'PROVIDER_BUSY',
      modelId: model,
      resumesAt,
      pauses: [{ model, roles, reason: 'PROVIDER_BUSY', resumesAt, failure: null, test: null }],
    });

  it("holds Manual Retry with the time while the mail's model is paused, until the pause ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const resumesAt = new Date(Date.now() + 60_000).toISOString();
    vi.mocked(api.getAISettings).mockResolvedValue(
      paused('gemini-2.5-flash', ['detailed'], resumesAt),
    );
    vi.mocked(api.getMessages).mockResolvedValue(page([needsOk]));
    show('/gmail');
    const held = await screen.findByRole('button', {
      name: `Paused until about ${clock(resumesAt)}`,
    });
    expect(held).toBeDisabled();
    // The longer text wraps, so the AI Status column keeps its width.
    expect(held).toHaveClass('whitespace-normal');
    expect(screen.queryByRole('button', { name: 'Manual Retry' })).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(61_000));
    expect(screen.getByRole('button', { name: 'Manual Retry' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Manual Retry' })).toHaveClass('whitespace-nowrap');
  });

  it('shows on the row until when AI cannot be used, when the server refuses the OK', async () => {
    const resumesAt = new Date(Date.now() + 5 * 60_000).toISOString();
    vi.mocked(api.retryEmail)
      .mockRejectedValueOnce(approvalNeeded)
      .mockRejectedValueOnce(
        new ApiError('no', 'http', 409, 'AI_ACCESS_UNAVAILABLE', {
          state: 'LIMITED',
          reason: 'PROVIDER_BUSY',
          resumesAt,
          modelId: 'gemini-3.8-flash',
          failure: null,
        }),
      );
    await clickManualRetry();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry anyway' }));
    await waitFor(() =>
      expect(screen.queryByText('Retry with a possible extra charge?')).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole('button', { name: `Paused until about ${clock(resumesAt)}` }),
    ).toBeDisabled();
    expect(screen.queryByText(/Fix AI access/)).toBeNull();
    expect(api.retryEmail).toHaveBeenCalledTimes(2);
  });

  it("shows the mail's new state on the next reload after the OK", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Only the other model is paused: nothing else makes the page reload now.
    vi.mocked(api.getAISettings).mockResolvedValue(
      paused('gemini-2.5-flash-lite', ['fast'], new Date(Date.now() + 600_000).toISOString()),
    );
    // The server shows the mail as stopped until the worker takes the retry, a second later.
    let takenAt: number | null = null;
    vi.mocked(api.retryEmail)
      .mockRejectedValueOnce(approvalNeeded)
      .mockImplementationOnce(async () => {
        takenAt = Date.now() + 1_000;
        return { success: true };
      });
    await clickManualRetry();
    const stillStopped = message({
      processingState: 'FAILED',
      aiStatus: aiStatus({ reason: 'INTERNAL_ERROR', step: null, nextStep: 'MANUAL_RETRY' }),
    });
    const waitingAgain = message({ processingState: 'PENDING', aiStatus: aiStatus() });
    vi.mocked(api.getMessages).mockImplementation(async () => {
      if (takenAt === null) return page([needsOk]);
      return page([Date.now() < takenAt ? stillStopped : waitingAgain]);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Retry anyway' }));
    await waitFor(() =>
      expect(screen.queryByText('Retry with a possible extra charge?')).not.toBeInTheDocument(),
    );
    await act(() => vi.advanceTimersByTimeAsync(2_500));
    expect(screen.getByText('Waiting for AI')).toBeInTheDocument();
    expect(screen.queryByText('Needs your OK')).toBeNull();
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
    // The AI's note is folded on the history row; opening it names who read the mail.
    fireEvent.click(await screen.findByRole('button', { name: 'Show the AI note' }));
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
