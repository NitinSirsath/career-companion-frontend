// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { ProcessingRefreshObserver } from '../components/ProcessingRefreshObserver';
import { AIAccessNotice } from '../components/ai/AIAccessNotice';
import type { AIFailure, AIModelPause, AISettingsResponse } from '../contracts/ai';
import {
  PROCESSING_REFRESH_WINDOW_MS,
  getProcessingRefreshUntil,
  resetProcessingRefresh,
} from '../lib/processingRefresh';
import { renderPart } from './render';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { getAISettings: vi.fn(), readWaitingMail: vi.fn(), getGmailStatus: vi.fn() },
}));

const settings = (
  access: Partial<AISettingsResponse['access']>,
  extra: Partial<AISettingsResponse> = {},
): AISettingsResponse => ({
  configured: true,
  provider: 'gemini',
  offeredProviders: ['gemini'],
  models: {
    fast: { id: 'gemini-3.5-flash-lite', source: 'RECOMMENDED' },
    detailed: { id: 'gemini-3.8-flash', source: 'RECOMMENDED' },
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
  usageToday: { day: '2026-10-14', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 500, resetsAt: '2026-10-15T00:00:00.000Z' },
  waitingEmails: 0,
  needsYourOk: { emails: 0, model: null, lastTriedAt: null, tries: 0 },
  consent: null,
  connections: [],
  ...extra,
});

let queryClient: QueryClient;
/** The banner as the Mails and Gmail Sync pages show it. */
const show = () => renderPart(<AIAccessNotice />, queryClient);
/** The page loads the AI settings again, as it does while it waits for an answer. */
const reload = () => act(() => queryClient.invalidateQueries({ queryKey: ['aiSettings'] }));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetProcessingRefresh();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => vi.useRealTimers());

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const TIME = String.raw`\d{1,2}:\d{2} [AP]M`;
const busyFailure = (overrides: Partial<AIFailure> = {}): AIFailure => ({
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
  at: inMinutes(-1),
  waitedMs: 3_000,
  timeoutMs: 60_000,
  attempt: null,
  maxAttempts: null,
  ...overrides,
});
const modelPause = (overrides: Partial<AIModelPause> = {}): AIModelPause => ({
  model: 'gemini-3.8-flash',
  roles: ['detailed'],
  reason: 'PROVIDER_BUSY',
  resumesAt: inMinutes(10),
  failure: busyFailure(),
  test: null,
  ...overrides,
});
/** The AI settings while a model's pause blocks, as the server shows them. */
const pausedBy = (pause: AIModelPause, extra: Partial<AISettingsResponse> = {}) =>
  settings(
    {
      state: 'LIMITED',
      reason: pause.reason,
      modelId: pause.model,
      resumesAt: pause.resumesAt,
      failure: pause.failure,
      pauses: [pause],
    },
    { waitingEmails: 1, ...extra },
  );

describe('the yellow banner', () => {
  const notice = () => screen.findByRole('status', { name: 'AI status' });

  it('names the model, the code and the next try, and says the button sends 1 test mail (screen 1)', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(pausedBy(modelPause()));
    show();
    const banner = await notice();
    expect(within(banner).getByText('Gemini 3.8 Flash is busy right now')).toBeInTheDocument();
    expect(banner).toHaveTextContent(
      new RegExp(
        `Google answered 503 UNAVAILABLE at ${TIME}\\. NorthList tries again by itself at about ${TIME}\\. 1 email is waiting\\.`,
      ),
    );
    expect(within(banner).getByText('503 UNAVAILABLE').tagName).toBe('STRONG');
    expect(within(banner).getByRole('button', { name: 'Read waiting mails now' })).toBeEnabled();
    expect(within(banner).getByText('Sends 1 mail first, as a test.')).toBeInTheDocument();
    expect(within(banner).getByRole('link', { name: 'AI providers page' })).toHaveAttribute(
      'href',
      '/ai',
    );
    expect(banner).not.toHaveTextContent(/continues by itself|Paused until|Sync/);
  });

  it('no answer in time names our time limit and the try (screen 2)', async () => {
    const noAnswer = busyFailure({
      kind: 'NO_ANSWER_IN_TIME',
      cause: 'TIMEOUT',
      httpStatus: null,
      providerCode: null,
      waitedMs: 75_000,
      attempt: 1,
      maxAttempts: 3,
    });
    vi.mocked(api.getAISettings).mockResolvedValue(pausedBy(modelPause({ failure: noAnswer })));
    show();
    const banner = await notice();
    expect(within(banner).getByText('Gemini 3.8 Flash did not answer in time')).toBeInTheDocument();
    expect(banner).toHaveTextContent(
      new RegExp(
        `No answer within 60 seconds at ${TIME}\\. NorthList tries again by itself at about ${TIME} \\(try 2 of 3\\)\\. 1 email is waiting\\.`,
      ),
    );
    expect(within(banner).getByText('60 seconds').tagName).toBe('STRONG');
  });

  it('a mail that needs your OK, with no other mail waiting: no button, never "continues by itself" (screen 4)', async () => {
    const noAnswer = busyFailure({ kind: 'NO_ANSWER_IN_TIME', cause: 'TIMEOUT', attempt: 3 });
    vi.mocked(api.getAISettings).mockResolvedValue(
      pausedBy(modelPause({ failure: noAnswer }), {
        waitingEmails: 0,
        needsYourOk: {
          emails: 1,
          model: 'gemini-3.8-flash',
          lastTriedAt: inMinutes(-1),
          tries: 3,
        },
      }),
    );
    show();
    const banner = await notice();
    expect(within(banner).getByText('1 email needs your OK')).toBeInTheDocument();
    expect(banner).toHaveTextContent(
      new RegExp(
        `Gemini 3.8 Flash did not answer it 3 times, the last at ${TIME}\\. NorthList stopped trying it by itself\\. Retry it from the list below when you want\\.`,
      ),
    );
    expect(banner).not.toHaveTextContent(/continues by itself|tries again by itself/);
    expect(within(banner).queryByRole('button')).toBeNull();
  });

  it('the free-tier daily limit: no button, when it resets and how to read sooner (screen 6)', async () => {
    const daily = busyFailure({
      kind: 'RATE_LIMITED',
      httpStatus: 429,
      providerCode: 'RESOURCE_EXHAUSTED',
      quotaScope: 'PER_DAY',
      freeTier: true,
    });
    vi.mocked(api.getAISettings).mockResolvedValue(
      pausedBy(modelPause({ reason: 'RATE_LIMITED', failure: daily }), { waitingEmails: 4 }),
    );
    show();
    const banner = await notice();
    expect(
      within(banner).getByText('Your free Gemini limit for today is used up'),
    ).toBeInTheDocument();
    expect(banner).toHaveTextContent(
      new RegExp(
        `Google answered 429 RESOURCE_EXHAUSTED \\(daily limit, free tier\\) for Gemini 3.8 Flash at ${TIME}\\. It resets at about ${TIME}, and reading continues by itself then\\. 4 emails are waiting\\.`,
      ),
    );
    expect(
      within(banner).getByText('To read sooner, turn on billing for your key in Google AI Studio.'),
    ).toBeInTheDocument();
    expect(
      within(banner).getByRole('link', { name: 'Open Google AI Studio billing' }),
    ).toHaveAttribute('href', 'https://ai.google.dev/gemini-api/docs/billing');
    expect(within(banner).getByRole('link', { name: 'AI providers page' })).toBeInTheDocument();
    expect(within(banner).queryByRole('button')).toBeNull();
  });

  it('with two paused models, shows the one that blocks most, then the other', async () => {
    const fast = modelPause({
      model: 'gemini-3.5-flash-lite',
      roles: ['fast'],
      resumesAt: inMinutes(5),
    });
    const shown = pausedBy(modelPause());
    vi.mocked(api.getAISettings).mockResolvedValue({
      ...shown,
      access: { ...shown.access, pauses: [...shown.access.pauses, fast] },
    });
    show();
    const banner = await notice();
    expect(within(banner).getByText('Gemini 3.8 Flash is busy right now')).toBeInTheDocument();
    expect(within(banner).getByText('Also paused: Gemini 3.5 Flash-Lite.')).toBeInTheDocument();
  });

  it('takes the safety-limit number from the settings', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(
      settings(
        { state: 'LIMITED', reason: 'SAFETY_LIMIT', resumesAt: inMinutes(60) },
        {
          waitingEmails: 2,
          safetyLimit: { callsPerDay: 250, resetsAt: inMinutes(60) },
        },
      ),
    );
    show();
    const banner = await notice();
    expect(banner).toHaveTextContent("You reached NorthList's daily AI limit");
    expect(banner).toHaveTextContent(
      "NorthList makes at most 250 AI calls a day for you. This is our limit, not Google's.",
    );
  });
});

describe('Read waiting mails now', () => {
  const busy = (resumesAt: string, waitingEmails = 1) =>
    pausedBy(modelPause({ resumesAt }), { waitingEmails });
  const readyWith = (waitingEmails: number) => settings({}, { waitingEmails });
  /** Right after the click: the paused model's test mail waits for its answer. */
  const testing = (resumesAt: string, waitingEmails = 1) =>
    settings(
      {
        pauses: [
          modelPause({
            resumesAt,
            test: { emailId: 'email-1', startedAt: new Date().toISOString(), result: null },
          }),
        ],
      },
      { waitingEmails },
    );
  /** Google answered the test mail: still busy, and the pause did not get longer. */
  const stillBusy = () =>
    pausedBy(
      modelPause({
        resumesAt: inMinutes(2),
        failure: busyFailure({ at: new Date().toISOString() }),
        test: { emailId: 'email-1', startedAt: inMinutes(-1.5), result: 'PROVIDER_BUSY' },
      }),
      { waitingEmails: 2 },
    );
  const notice = () => screen.findByRole('status', { name: 'AI status' });
  const button = () => screen.findByRole('button', { name: 'Read waiting mails now' });

  it.each([
    ['a key problem', { state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }],
    ['the daily safety limit', { state: 'LIMITED', reason: 'SAFETY_LIMIT' }],
  ] as const)('is not offered for %s', async (_label, access) => {
    vi.mocked(api.getAISettings).mockResolvedValue(settings(access, { waitingEmails: 1 }));
    show();
    await notice();
    expect(screen.queryByRole('button', { name: 'Read waiting mails now' })).toBeNull();
  });

  it('sends 1 test mail, says "Trying" until its answer comes, then shows the result (screen 3)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const until = inMinutes(10);
    vi.mocked(api.getAISettings).mockResolvedValue(busy(until, 2));
    vi.mocked(api.readWaitingMail).mockResolvedValue(testing(until));
    show();
    const start = await button();
    vi.mocked(api.getAISettings).mockResolvedValue(testing(until));
    fireEvent.click(start);
    await waitFor(() => expect(api.readWaitingMail).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Trying again now. 1 email is waiting.')).toBeInTheDocument();
    expect(await notice()).toHaveTextContent('Gemini 3.8 Flash is busy right now');
    expect(screen.getByRole('button', { name: 'Trying now…' })).toBeDisabled();
    expect(screen.getByText('Sends 1 mail first, as a test.')).toBeInTheDocument();
    expect(getProcessingRefreshUntil()).toBeGreaterThan(Date.now());

    // No answer for longer than a minute: the notice still says it is trying.
    await act(() => vi.advanceTimersByTimeAsync(90_000));
    await reload();
    expect(screen.getByText('Trying again now. 1 email is waiting.')).toBeInTheDocument();

    // Google answers the test mail: still busy, and the pause did not get longer.
    vi.mocked(api.getAISettings).mockResolvedValue(stillBusy());
    await reload();
    expect(await screen.findByText('Gemini 3.8 Flash is still busy')).toBeInTheDocument();
    expect(await notice()).toHaveTextContent(
      new RegExp(
        `Tried 1 test mail at ${TIME}: Google answered 503 UNAVAILABLE\\. The pause did not get longer\\. NorthList tries again by itself at about ${TIME}\\. 2 emails are waiting\\.`,
      ),
    );
    expect(await button()).toBeEnabled();
  });

  /** The banner with the shell's refresh window, which reloads the page by itself. */
  const showWithRefresh = () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      gmailEmail: 'user@gmail.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });
    renderPart(
      <>
        <ProcessingRefreshObserver />
        <AIAccessNotice />
      </>,
      queryClient,
    );
  };

  it('keeps the page reloading past the refresh window until the test mail has its answer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const until = inMinutes(10);
    vi.mocked(api.getAISettings).mockResolvedValue(busy(until, 2));
    vi.mocked(api.readWaitingMail).mockResolvedValue(testing(until));
    showWithRefresh();
    const start = await button();
    vi.mocked(api.getAISettings).mockResolvedValue(testing(until));
    fireEvent.click(start);
    expect(await screen.findByText('Trying again now. 1 email is waiting.')).toBeInTheDocument();

    // The test mail waits longer than one refresh window; nothing reloads the page by hand.
    await act(() => vi.advanceTimersByTimeAsync(PROCESSING_REFRESH_WINDOW_MS + 30_000));
    expect(screen.getByRole('button', { name: 'Trying now…' })).toBeDisabled();
    vi.mocked(api.getAISettings).mockResolvedValue(stillBusy());
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(await screen.findByText('Gemini 3.8 Flash is still busy')).toBeInTheDocument();
    expect(await button()).toBeEnabled();
  });

  it('keeps the page reloading past the refresh window until the mail read after a pause shows', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.getAISettings).mockResolvedValue(
      busy(new Date(Date.now() + 20_000).toISOString()),
    );
    showWithRefresh();
    await button();
    vi.mocked(api.getAISettings).mockResolvedValue(readyWith(1));
    await act(() => vi.advanceTimersByTimeAsync(26_000));
    expect(await screen.findByText('Trying again now. 1 email is waiting.')).toBeInTheDocument();

    // Reading the mail takes longer than one refresh window; nothing reloads the page by hand.
    await act(() => vi.advanceTimersByTimeAsync(PROCESSING_REFRESH_WINDOW_MS + 30_000));
    expect(screen.getByRole('button', { name: 'Trying now…' })).toBeDisabled();
    vi.mocked(api.getAISettings).mockResolvedValue(readyWith(0));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'AI status' })).not.toBeInTheDocument(),
    );
  });

  it('stops reloading when a try reads no mail for a whole refresh window', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.getAISettings).mockResolvedValue(
      busy(new Date(Date.now() + 20_000).toISOString()),
    );
    showWithRefresh();
    await button();
    vi.mocked(api.getAISettings).mockResolvedValue(readyWith(1));
    await act(() => vi.advanceTimersByTimeAsync(26_000));
    await screen.findByText('Trying again now. 1 email is waiting.');

    await act(() => vi.advanceTimersByTimeAsync(3 * PROCESSING_REFRESH_WINDOW_MS));
    expect(getProcessingRefreshUntil()).toBeLessThan(Date.now());
    // The try is over: the banner shows the server's state again.
    expect(screen.queryByText('Trying again now. 1 email is waiting.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trying now…' })).toBeNull();
    const loads = vi.mocked(api.getAISettings).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(api.getAISettings).toHaveBeenCalledTimes(loads);
  });

  it('hides the notice once the waiting mail was read', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(busy(inMinutes(10)));
    vi.mocked(api.readWaitingMail).mockResolvedValue(readyWith(1));
    show();
    const start = await button();
    vi.mocked(api.getAISettings).mockResolvedValue(readyWith(0));
    fireEvent.click(start);
    await waitFor(() => expect(api.readWaitingMail).toHaveBeenCalledTimes(1));
    await reload();
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'AI status' })).not.toBeInTheDocument(),
    );
    // A later pause is a new story, not an answer to the old try.
    vi.mocked(api.getAISettings).mockResolvedValue(busy(inMinutes(30)));
    await reload();
    expect(await screen.findByText('Gemini 3.8 Flash is busy right now')).toBeInTheDocument();
    expect(screen.queryByText(/Tried 1 test mail/)).toBeNull();
  });

  it('says so when the new try could not be started, and offers it again', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(busy(inMinutes(10)));
    vi.mocked(api.readWaitingMail).mockRejectedValue(new Error('network'));
    show();
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
    show();
    await button();
    expect(getProcessingRefreshUntil()).toBe(0);
    vi.mocked(api.getAISettings).mockResolvedValue(readyWith(1));
    await act(() => vi.advanceTimersByTimeAsync(26_000));
    expect(getProcessingRefreshUntil()).toBeGreaterThan(Date.now());
    await reload();
    expect(await screen.findByText('Trying again now. 1 email is waiting.')).toBeInTheDocument();
    // No test mail: the pause ended by itself, and the waiting mail is read as usual.
    expect(screen.getByRole('button', { name: 'Trying now…' })).toBeDisabled();
    expect(screen.queryByText('Sends 1 mail first, as a test.')).toBeNull();
    expect(api.readWaitingMail).not.toHaveBeenCalled();
  });
});
