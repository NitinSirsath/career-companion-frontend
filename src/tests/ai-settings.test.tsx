// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { AIFailure, AISettingsResponse } from '../contracts/ai';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      getGmailStatus: vi.fn(),
      getAISettings: vi.fn(),
      saveAISettings: vi.fn(),
      checkAISettings: vi.fn(),
      runAISampleTest: vi.fn(),
      removeAISettings: vi.fn(),
    },
  };
});

import { routeTree } from '../routeTree.gen';

const KEY = 'AIza-SENTINEL-test-key-0123456789';
const MOCK_USER = { id: 'u', email: 'test@test.local', name: 'Test' };

const base: AISettingsResponse = {
  configured: false,
  provider: null,
  offeredProviders: ['gemini'],
  models: null,
  access: {
    state: 'NOT_SET_UP',
    reason: 'NOT_SET_UP',
    modelId: null,
    resumesAt: null,
    failure: null,
    pauses: [],
    verified: false,
    lastCheckedAt: null,
  },
  lastFailure: null,
  usageToday: { day: '2026-10-02', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 500, resetsAt: '2026-10-03T00:00:00.000Z' },
  waitingEmails: 3,
  needsYourOk: { emails: 0, model: null, lastTriedAt: null, tries: 0 },
  consent: null,
};
const ready: AISettingsResponse = {
  ...base,
  configured: true,
  provider: 'gemini',
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
    lastCheckedAt: '2026-10-02T10:00:00.000Z',
  },
  usageToday: { day: '2026-10-02', calls: 12, inputTokens: 3400, outputTokens: 900 },
  waitingEmails: 0,
  consent: {
    disclosure: 'gemini-draft-2026-10',
    consentedAt: '2026-10-02T09:00:00.000Z',
    current: true,
  },
};

let queryClient: QueryClient;
let storageWrites: string[];

function renderPage(path = '/ai') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: MOCK_USER },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

/** Everything the browser keeps: query data, mutation variables, storage writes, the URL. */
const browserState = () =>
  JSON.stringify([
    queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.state.data),
    queryClient
      .getMutationCache()
      .getAll()
      .map((m) => m.state.variables),
    storageWrites,
    window.location.href,
  ]);

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'a@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
  });
  storageWrites = [];
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key: string, value: string) {
    storageWrites.push(`${key}=${value}`);
  });
});
afterEach(() => vi.restoreAllMocks());

async function openSetup() {
  vi.mocked(api.getAISettings).mockResolvedValue(base);
  renderPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Set up Google Gemini' }));
  return screen.getByLabelText('API key') as HTMLInputElement;
}

describe('AI provider page: choosing and setting up a provider', () => {
  it('offers only curated providers, with cost model and the subscription note', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(base);
    renderPage();
    expect(await screen.findByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('Free tier available')).toBeInTheDocument();
    expect(screen.getByText(/subscription is not an API key/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI Provider' })).toBeInTheDocument();
  });

  it('guides key setup with a password field that is never prefilled, plus data use and consent', async () => {
    const key = await openSetup();
    expect(key).toHaveAttribute('type', 'password');
    expect(key).toHaveAttribute('autocomplete', 'off');
    expect(key.value).toBe('');
    expect(screen.getByRole('link', { name: 'Get a Google Gemini API key' })).toHaveAttribute(
      'href',
      'https://aistudio.google.com/apikey',
    );
    expect(screen.getByText(/sender, subject, Gmail labels/)).toBeInTheDocument();
    expect(screen.getByText(/at most 500 AI calls a day/)).toBeInTheDocument();
    // A new key can use these; Google serves the 2.5 models only to keys that used them before.
    expect(screen.getByText(/Fast screening: Gemini 3.5 Flash-Lite/)).toHaveTextContent(
      '(recommended)',
    );
    expect(screen.getByText(/Detailed analysis: Gemini 3.8 Flash/)).toHaveTextContent(
      '(recommended)',
    );
  });

  it('requires consent before anything is sent', async () => {
    const key = await openSetup();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm that you understand');
    expect(api.saveAISettings).not.toHaveBeenCalled();
  });

  it('sends the key once, clears the field at once, and keeps it nowhere in the browser', async () => {
    let resolveSave!: (value: Awaited<ReturnType<typeof api.saveAISettings>>) => void;
    vi.mocked(api.saveAISettings).mockReturnValue(
      new Promise((resolve) => (resolveSave = resolve)),
    );
    const key = await openSetup();
    fireEvent.change(key, { target: { value: ` ${KEY} ` } });
    fireEvent.click(screen.getByLabelText(/I understand that these details/));
    fireEvent.click(screen.getByRole('button', { name: 'Save and verify' }));
    expect(api.saveAISettings).toHaveBeenCalledWith({
      provider: 'gemini',
      apiKey: KEY,
      models: { fast: null, detailed: null },
      consentDisclosure: 'gemini-draft-2026-10',
    });
    expect(key.value).toBe(''); // cleared while the request is in flight
    vi.mocked(api.getAISettings).mockResolvedValue(ready); // what the server now reports
    resolveSave({
      ...ready,
      waitingEmails: 1,
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    expect(
      await screen.findByText(/Connected. Waiting emails are being processed/),
    ).toBeInTheDocument();
    expect(screen.getByText('Saved (hidden)')).toBeInTheDocument();
    expect(browserState()).not.toContain('SENTINEL');
  });

  it('shows the provider-specific fix when the key is rejected, and saves nothing', async () => {
    vi.mocked(api.saveAISettings).mockRejectedValue(
      new ApiError('refused', 'http', 422, 'AI_ACCESS_REJECTED', {
        reason: 'KEY_REJECTED',
        modelId: null,
      }),
    );
    const key = await openSetup();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(screen.getByLabelText(/I understand that these details/));
    fireEvent.click(screen.getByRole('button', { name: 'Save and verify' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Google Gemini rejected this key');
    expect(alert).toHaveTextContent('Nothing was saved');
    expect(within(alert).getByRole('link')).toHaveAttribute(
      'href',
      'https://aistudio.google.com/apikey',
    );
    expect(key.value).toBe('');
    expect(queryClient.getQueryData(['aiSettings'])).toEqual(base);
    expect(browserState()).not.toContain('SENTINEL');
  });

  it('never claims success when the save outcome is uncertain, and never resends', async () => {
    vi.mocked(api.saveAISettings).mockRejectedValue(new ApiError('timed out', 'timeout'));
    const key = await openSetup();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(screen.getByLabelText(/I understand that these details/));
    fireEvent.click(screen.getByRole('button', { name: 'Save and verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not confirm whether this was saved',
    );
    expect(api.saveAISettings).toHaveBeenCalledTimes(1);
  });

  it('clears a typed key when the form goes away', async () => {
    const key = await openSetup();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByLabelText('API key')).not.toBeInTheDocument());
    expect(key.value).toBe('');
  });
});

describe('AI provider page: status and actions', () => {
  it('shows models, our own counts and the safety limit, never the key', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    renderPage();
    expect(await screen.findByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Saved (hidden)')).toBeInTheDocument();
    expect(screen.getByText(/Gemini 3.5 Flash-Lite \(recommended\)/)).toBeInTheDocument();
    expect(screen.getByText(/sent 12 AI calls/)).toHaveTextContent(
      'Our own count, not your Google Gemini bill',
    );
    expect(screen.getByText(/500 AI calls a day/)).toHaveTextContent("not Google Gemini's quota");
    // Only one provider is offered, so there is nothing to switch to.
    expect(screen.queryByRole('button', { name: 'Switch provider' })).not.toBeInTheDocument();
  });

  it.each([
    [
      { state: 'NEEDS_ATTENTION', reason: 'ACCOUNT_OR_BILLING' },
      'Google Gemini refused requests for your account',
      'Open Google Gemini billing',
    ],
    [
      { state: 'NEEDS_ATTENTION', reason: 'MODEL_UNAVAILABLE', modelId: 'gemini-2.5-flash' },
      'Your key cannot use Gemini 2.5 Flash',
      null,
    ],
    [
      { state: 'LIMITED', reason: 'RATE_LIMITED', resumesAt: '2026-10-02T14:05:00.000Z' },
      'is limiting requests',
      null,
    ],
    [
      { state: 'LIMITED', reason: 'PROVIDER_BUSY', resumesAt: '2026-10-02T14:05:00.000Z' },
      'Google Gemini is busy right now',
      null,
    ],
    [
      { state: 'LIMITED', reason: 'SAFETY_LIMIT', resumesAt: '2026-10-03T00:00:00.000Z' },
      "You reached Career Companion's daily AI limit",
      null,
    ],
  ] as const)('explains %o with one fix', async (access, title, link) => {
    vi.mocked(api.getAISettings).mockResolvedValue({
      ...ready,
      access: { ...ready.access, modelId: null, resumesAt: null, ...access },
    });
    renderPage();
    const status = await screen.findByText(new RegExp(title));
    expect(status).toBeInTheDocument();
    if (link)
      expect(screen.getByRole('link', { name: link })).toHaveAttribute(
        'href',
        'https://ai.google.dev/gemini-api/docs/billing',
      );
    if (access.state === 'LIMITED')
      expect(
        screen.getByText(/tries again by itself|Reading continues by itself/),
      ).toBeInTheDocument();
  });

  it('checks the saved key again', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.checkAISettings).mockResolvedValue({
      ...ready,
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Check again' }));
    expect(
      await screen.findByText('Google Gemini confirmed your key and models.'),
    ).toBeInTheDocument();
  });

  it('changes models without re-entering the key or consent', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.saveAISettings).mockResolvedValue({
      ...ready,
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Change models or key' }));
    expect(screen.getByLabelText('API key')).toHaveAttribute(
      'placeholder',
      'Leave blank to keep the saved key',
    );
    expect(screen.queryByLabelText(/I understand that these details/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Fast screening'), {
      target: { value: 'gemini-2.5-flash' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save and verify' }));
    await waitFor(() =>
      expect(api.saveAISettings).toHaveBeenCalledWith({
        provider: 'gemini',
        models: { fast: 'gemini-2.5-flash', detailed: null },
      }),
    );
  });

  it('offers only tested models in Advanced', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Change models or key' }));
    const detailed = screen.getByLabelText('Detailed analysis') as HTMLSelectElement;
    expect([...detailed.options].map((o) => o.value)).toEqual([
      '',
      'gemini-2.5-flash',
      'gemini-3.8-flash',
    ]);
  });

  it('runs the sample test and shows, without storing, the extracted result', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.runAISampleTest).mockResolvedValue({
      provider: 'gemini',
      models: { fast: 'gemini-2.5-flash-lite', detailed: 'gemini-2.5-flash' },
      classification: { decision: 'RELEVANT', category: 'INTERVIEW', confidence: 0.93 },
      extraction: {
        companyName: 'Northwind Robotics',
        jobTitle: 'Senior Platform Engineer',
        interviewStage: null,
        interviewDate: '2026-11-04',
        interviewTime: '2:00 PM',
        actionRequired: true,
        requestedAction: 'Confirm the time',
        actionDeadline: null,
      },
      usage: { calls: 2, inputTokens: 400, outputTokens: 120 },
    });
    renderPage();
    expect(await screen.findByText(/never your mail/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try a sample email' }));
    expect(await screen.findByText('Northwind Robotics')).toBeInTheDocument();
    expect(
      JSON.stringify(
        queryClient
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain('Northwind');
  });

  it('removes the key after confirmation', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.removeAISettings).mockResolvedValue({ removed: true });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText(/New emails will wait until you set up AI again/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));
    await waitFor(() => expect(api.removeAISettings).toHaveBeenCalledTimes(1));
  });
});

describe("AI provider page: each model's state (mock screen 7)", () => {
  // Local times, so the clock reads the same in every time zone. "Now" is Oct 14, 11:46 AM.
  const at = (hours: number, minutes: number, secs = 0) =>
    new Date(2026, 9, 14, hours, minutes, secs).toISOString();
  const busy: AIFailure = {
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
    at: at(11, 44, 2),
    waitedMs: 2_000,
    timeoutMs: 60_000,
    attempt: null,
    maxAttempts: null,
  };
  const paused: AISettingsResponse = {
    ...ready,
    access: {
      state: 'LIMITED',
      reason: 'PROVIDER_BUSY',
      modelId: 'gemini-3.8-flash',
      resumesAt: at(11, 52),
      failure: busy,
      pauses: [
        {
          model: 'gemini-3.8-flash',
          roles: ['detailed'],
          reason: 'PROVIDER_BUSY',
          resumesAt: at(11, 52),
          failure: busy,
          test: null,
        },
      ],
      verified: true,
      lastCheckedAt: at(11, 40),
    },
    lastFailure: busy,
    usageToday: { day: '2026-10-14', calls: 14, inputTokens: 6120, outputTokens: 1480 },
    waitingEmails: 1,
  };
  const row = (term: string) => screen.getByText(term).nextElementSibling as HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 11, 46));
  });
  afterEach(() => vi.useRealTimers());

  it('shows each model working or paused, with the reason and the code', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(paused);
    renderPage();
    expect(await screen.findByText('Limited')).toBeInTheDocument();
    const problem = screen.getByText('Gemini 3.8 Flash is busy right now').parentElement!;
    expect(problem).toHaveTextContent(
      'Google answered 503 UNAVAILABLE at 11:44 AM. Career Companion tries again by itself at about 11:52 AM. Gemini 3.5 Flash-Lite is not affected. 1 email is waiting.',
    );
    expect(within(problem).getByText('503 UNAVAILABLE').tagName).toBe('STRONG');
    expect(row('Fast screening')).toHaveTextContent('Gemini 3.5 Flash-Lite (recommended)Working');
    expect(row('Detailed analysis')).toHaveTextContent(
      'Gemini 3.8 Flash (recommended)Paused until about 11:52 AM' +
        'Busy: Google answered 503 UNAVAILABLE at 11:44 AM, after 2 seconds.',
    );
    expect(row('Waiting')).toHaveTextContent(
      '1 email waiting for AI. It is read by itself when the pause ends.',
    );
    expect(screen.queryByText(/Sync Gmail/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Read waiting mails now/ }),
    ).not.toBeInTheDocument();
  });

  it('a check while a model is paused does not say "confirmed": the header says it', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(paused);
    vi.mocked(api.checkAISettings).mockResolvedValue({
      ...paused,
      access: { ...paused.access, lastCheckedAt: at(11, 46) },
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Check again' }));
    expect(await screen.findByText('Key verified · last checked Oct 14, 11:46 AM')).toBeVisible();
    expect(screen.queryByText(/confirmed your key/)).not.toBeInTheDocument();
  });

  it('a check that could not decide names the model and how long we waited', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.checkAISettings).mockResolvedValue({
      ...ready,
      verification: 'INCONCLUSIVE',
      verificationFailure: {
        ...busy,
        kind: 'NO_ANSWER_IN_TIME',
        cause: 'TIMEOUT',
        httpStatus: null,
        providerCode: null,
        waitedMs: 10_000,
        timeoutMs: 10_000,
      },
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Check again' }));
    expect(
      await screen.findByText(
        'Google Gemini did not confirm right now: Gemini 3.8 Flash did not answer within 10 seconds. Try again later.',
      ),
    ).toBeInTheDocument();
  });

  it('the sample test says which model did not answer in time', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(paused);
    vi.mocked(api.runAISampleTest).mockRejectedValue(
      new ApiError('failed', 'http', 502, 'AI_SAMPLE_FAILED', {
        failure: {
          ...busy,
          kind: 'NO_ANSWER_IN_TIME',
          cause: 'TIMEOUT',
          httpStatus: null,
          providerCode: null,
          waitedMs: 75_000,
        },
      }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Try a sample email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The sample test did not finish: Gemini 3.8 Flash did not answer within 60 seconds. It may still have used a few tokens.',
    );
  });
});
