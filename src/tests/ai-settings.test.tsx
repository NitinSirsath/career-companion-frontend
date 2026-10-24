// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { AIConnection, AIFailure, AISettingsResponse } from '../contracts/ai';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      getGmailStatus: vi.fn(),
      getAISettings: vi.fn(),
      saveAIProvider: vi.fn(),
      activateAIProvider: vi.fn(),
      checkAIProvider: vi.fn(),
      runAISampleTest: vi.fn(),
      removeAIProvider: vi.fn(),
    },
  };
});

import { routeTree } from '../routeTree.gen';
import { chooseOption } from './choose';

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
  connections: [],
};
const geminiActive: AIConnection = {
  provider: 'gemini',
  active: true,
  state: 'READY',
  reason: null,
  modelId: null,
  failure: null,
  models: {
    fast: { id: 'gemini-3.5-flash-lite', source: 'RECOMMENDED' },
    detailed: { id: 'gemini-3.8-flash', source: 'RECOMMENDED' },
  },
  verified: true,
  lastCheckedAt: '2026-10-02T10:00:00.000Z',
  consentCurrent: true,
};
const openaiSaved: AIConnection = {
  provider: 'openai',
  active: false,
  state: 'READY',
  reason: null,
  modelId: null,
  failure: null,
  models: {
    fast: { id: 'gpt-5-nano', source: 'RECOMMENDED' },
    detailed: { id: 'gpt-5-mini', source: 'RECOMMENDED' },
  },
  verified: true,
  lastCheckedAt: '2026-10-01T18:10:00.000Z',
  consentCurrent: true,
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
  connections: [geminiActive],
};
/** Gemini reads the mail; OpenAI is connected too, and Claude is still free. */
const two: AISettingsResponse = {
  ...ready,
  offeredProviders: ['gemini', 'openai', 'anthropic'],
  connections: [geminiActive, openaiSaved],
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
  fireEvent.click(await screen.findByRole('button', { name: 'Connect Google Gemini' }));
  return (await screen.findByLabelText('API key')) as HTMLInputElement;
}

const consentBox = () => screen.getByLabelText(/I understand that these details/);

describe('AI providers page: connecting the first provider', () => {
  it('offers only curated providers, with cost model and the subscription note', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(base);
    renderPage();
    expect(await screen.findByText('Connect your first provider')).toBeInTheDocument();
    expect(screen.getByText('Google Gemini')).toBeInTheDocument();
    expect(screen.getByText('Free tier available')).toBeInTheDocument();
    expect(screen.getByText(/subscription is not an API key/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI providers' })).toBeInTheDocument();
    // Nothing is connected yet, so the header has no "Connect a provider".
    expect(screen.queryByRole('button', { name: 'Connect a provider' })).not.toBeInTheDocument();
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
    // A new key can use these; Google serves the 2.5 models only to keys that used them before.
    expect(
      screen.getByText(
        /Models: Fast screening Gemini 3.5 Flash-Lite, Detailed analysis Gemini 3.8 Flash/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/so Google Gemini becomes active/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/active now/)).not.toBeInTheDocument();
  });

  it('requires consent before anything is sent', async () => {
    const key = await openSetup();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect and verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm that you understand');
    expect(api.saveAIProvider).not.toHaveBeenCalled();
  });

  it('sends the key once, clears the field at once, and keeps it nowhere in the browser', async () => {
    let resolveSave!: (value: Awaited<ReturnType<typeof api.saveAIProvider>>) => void;
    vi.mocked(api.saveAIProvider).mockReturnValue(
      new Promise((resolve) => (resolveSave = resolve)),
    );
    const key = await openSetup();
    fireEvent.change(key, { target: { value: ` ${KEY} ` } });
    fireEvent.click(consentBox());
    fireEvent.click(screen.getByRole('button', { name: 'Connect and verify' }));
    expect(api.saveAIProvider).toHaveBeenCalledWith('gemini', {
      apiKey: KEY,
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
      await screen.findByText(
        'Google Gemini is connected and reads new mails now. Waiting emails are being processed.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Reads your mail now')).toBeInTheDocument();
    expect(browserState()).not.toContain('SENTINEL');
  });

  it('shows the provider-specific fix when the key is rejected, and saves nothing', async () => {
    vi.mocked(api.saveAIProvider).mockRejectedValue(
      new ApiError('refused', 'http', 422, 'AI_ACCESS_REJECTED', {
        reason: 'KEY_REJECTED',
        modelId: null,
      }),
    );
    const key = await openSetup();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(consentBox());
    fireEvent.click(screen.getByRole('button', { name: 'Connect and verify' }));
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
    vi.mocked(api.saveAIProvider).mockRejectedValue(new ApiError('timed out', 'timeout'));
    const key = await openSetup();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(consentBox());
    fireEvent.click(screen.getByRole('button', { name: 'Connect and verify' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not confirm whether this was saved',
    );
    expect(api.saveAIProvider).toHaveBeenCalledTimes(1);
  });

  it('clears a typed key when the dialog goes away', async () => {
    const key = await openSetup();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByLabelText('API key')).not.toBeInTheDocument());
    expect(key.value).toBe('');
  });
});

describe('AI providers page: the active provider', () => {
  it('shows the provider, its models, our own counts and the safety limit, never the key', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    renderPage();
    expect(await screen.findByText('Reads your mail now')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Fast screening' })).toHaveTextContent(
      'Gemini 3.5 Flash-Lite (recommended)',
    );
    expect(screen.getByText('12 of 500 AI calls today')).toBeInTheDocument();
    expect(screen.getByText(/3,400 input \/ 900 output tokens/)).toHaveTextContent(
      'for all providers together. Not your Google Gemini bill or quota.',
    );
    // Only one provider is offered, so there is nothing more to connect.
    expect(screen.queryByRole('button', { name: 'Connect a provider' })).not.toBeInTheDocument();
    expect(screen.getByText(/No other provider yet/)).toBeInTheDocument();
    expect(screen.queryByText(/Leave blank to keep the saved key/)).not.toBeInTheDocument();
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
      "You reached NorthList's daily AI limit",
      null,
    ],
  ] as const)('explains %o with one fix', async (access, title, link) => {
    vi.mocked(api.getAISettings).mockResolvedValue({
      ...ready,
      access: { ...ready.access, modelId: null, resumesAt: null, ...access },
      connections: [{ ...geminiActive, state: access.state, reason: access.reason }],
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
    else expect(screen.getAllByRole('button', { name: 'Replace key' })).toHaveLength(2);
  });

  it('checks the saved key again', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.checkAIProvider).mockResolvedValue({
      ...ready,
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Check key' }));
    await waitFor(() => expect(api.checkAIProvider).toHaveBeenCalledWith('gemini'));
    expect(
      await screen.findByText('Google Gemini confirmed your key and models.'),
    ).toBeInTheDocument();
  });

  it('changes a model in place, without the key or consent', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.saveAIProvider).mockResolvedValue({
      ...ready,
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage();
    await chooseOption(
      await screen.findByRole('combobox', { name: 'Fast screening' }),
      'Gemini 2.5 Flash',
    );
    await waitFor(() =>
      expect(api.saveAIProvider).toHaveBeenCalledWith('gemini', {
        models: { fast: 'gemini-2.5-flash' },
      }),
    );
    expect(
      await screen.findByText('Saved. New mails use Gemini 2.5 Flash for fast screening.'),
    ).toBeInTheDocument();
  });

  it('keeps the model when the key cannot use the new one', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.saveAIProvider).mockRejectedValue(
      new ApiError('refused', 'http', 422, 'AI_ACCESS_REJECTED', {
        reason: 'MODEL_UNAVAILABLE',
        modelId: 'gemini-2.5-flash',
      }),
    );
    renderPage();
    const fast = await screen.findByRole('combobox', { name: 'Fast screening' });
    await chooseOption(fast, 'Gemini 2.5 Flash');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This key cannot use Gemini 2.5 Flash. Choose another model. Nothing was saved.',
    );
    expect(fast).toHaveTextContent('Gemini 3.5 Flash-Lite (recommended)');
  });

  it('offers only tested models, the recommended one first', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    renderPage();
    fireEvent.click(await screen.findByRole('combobox', { name: 'Detailed analysis' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Gemini 3.8 Flash (recommended)',
      'Gemini 2.5 Flash',
    ]);
  });

  it('replaces the key in its own dialog, sending it once and keeping it nowhere', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.saveAIProvider).mockResolvedValue({
      ...ready,
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Replace key' }));
    const key = (await screen.findByLabelText('New API key')) as HTMLInputElement;
    expect(screen.getByText(/keeps working until the new one is verified/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/I understand that these details/)).not.toBeInTheDocument();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and verify' }));
    expect(api.saveAIProvider).toHaveBeenCalledWith('gemini', { apiKey: KEY });
    expect(key.value).toBe('');
    expect(
      await screen.findByText('New Google Gemini key saved and verified.'),
    ).toBeInTheDocument();
    expect(browserState()).not.toContain('SENTINEL');
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

  it('removes the only provider after confirmation: new mail then waits', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.removeAIProvider).mockResolvedValue(base);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText('New emails will wait until you connect a provider again.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));
    await waitFor(() => expect(api.removeAIProvider).toHaveBeenCalledWith('gemini', 'none'));
    expect(await screen.findByText('Your Google Gemini key is removed.')).toBeInTheDocument();
  });
});

describe('AI providers page: several providers, one active', () => {
  it('lists the other connected provider, which can be made active', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(two);
    vi.mocked(api.activateAIProvider).mockResolvedValue({
      ...two,
      provider: 'openai',
      connections: [
        { ...openaiSaved, active: true },
        { ...geminiActive, active: false },
      ],
    });
    renderPage();
    const list = await screen.findByRole('list', { name: 'Other connected providers' });
    expect(within(list).getByText('OpenAI')).toBeInTheDocument();
    expect(within(list).getByText('GPT-5 nano · GPT-5 mini')).toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Make active' }));
    expect(await screen.findByText('Use OpenAI for new mails?')).toBeInTheDocument();
    expect(screen.getByText(/Google Gemini stays connected/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Make OpenAI active' }));
    await waitFor(() => expect(api.activateAIProvider).toHaveBeenCalledWith('openai'));
    expect(await screen.findByText('OpenAI reads new mails now.')).toBeInTheDocument();
  });

  it('connects another provider as inactive unless the user makes it active', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(two);
    vi.mocked(api.saveAIProvider).mockResolvedValue({
      ...two,
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Connect a provider' }));
    const dialog = await screen.findByRole('dialog');
    // Connected providers are marked; only the free one can be chosen.
    expect(within(dialog).getAllByText('Connected')).toHaveLength(2);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Choose' }));
    const key = (await screen.findByLabelText('API key')) as HTMLInputElement;
    expect(screen.getByLabelText(/Make Anthropic Claude active now/)).not.toBeChecked();
    fireEvent.change(key, { target: { value: KEY } });
    fireEvent.click(consentBox());
    fireEvent.click(screen.getByRole('button', { name: 'Connect and verify' }));
    expect(api.saveAIProvider).toHaveBeenCalledWith('anthropic', {
      apiKey: KEY,
      consentDisclosure: 'anthropic-draft-2026-10',
      makeActive: false,
    });
    expect(
      await screen.findByText(
        'Anthropic Claude is connected. Make it active when you want it to read new mails.',
      ),
    ).toBeInTheDocument();
  });

  it('asks which provider reads new mail next when the active one is removed', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(two);
    vi.mocked(api.removeAIProvider).mockResolvedValue({
      ...base,
      offeredProviders: two.offeredProviders,
      connections: [openaiSaved],
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(await screen.findByLabelText('OpenAI reads new mails')).toBeChecked();
    fireEvent.click(screen.getByLabelText('No provider: new mails wait'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove key' }));
    await waitFor(() => expect(api.removeAIProvider).toHaveBeenCalledWith('gemini', 'none'));
    expect(
      await screen.findByText(
        'Your Google Gemini key is removed. No provider reads your mail now.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('No provider reads your mail.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Connected providers' })).toBeInTheDocument();
  });

  it('offers the other provider when the active key has a problem, and never switches by itself', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue({
      ...two,
      access: { ...two.access, state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' },
      connections: [
        { ...geminiActive, state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' },
        openaiSaved,
      ],
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Use OpenAI instead' }));
    expect(await screen.findByText('Use OpenAI for new mails?')).toBeInTheDocument();
    expect(api.activateAIProvider).not.toHaveBeenCalled();
  });

  it('checks an inactive provider from its menu', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(two);
    vi.mocked(api.checkAIProvider).mockResolvedValue({
      ...two,
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'More for OpenAI' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Check key' }));
    await waitFor(() => expect(api.checkAIProvider).toHaveBeenCalledWith('openai'));
    expect(await screen.findByText('OpenAI confirmed the key and models.')).toBeInTheDocument();
  });
});

describe("AI providers page: each model's state (mock screen 7)", () => {
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
    connections: [
      {
        ...geminiActive,
        state: 'LIMITED',
        reason: 'PROVIDER_BUSY',
        modelId: 'gemini-3.8-flash',
        failure: busy,
        lastCheckedAt: at(11, 40),
      },
    ],
  };
  /** A model role's row: its name and help, the model, and its state. */
  const row = (label: string) =>
    screen.getByText(label, { selector: 'span' }).parentElement!.parentElement as HTMLElement;

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
      'Google answered 503 UNAVAILABLE at 11:44 AM. NorthList tries again by itself at about 11:52 AM. Gemini 3.5 Flash-Lite is not affected. 1 email is waiting.',
    );
    expect(within(problem).getByText('503 UNAVAILABLE').tagName).toBe('STRONG');
    expect(row('Fast screening')).toHaveTextContent(
      /Gemini 3.5 Flash-Lite \(recommended\)Working$/,
    );
    expect(row('Detailed analysis')).toHaveTextContent(
      'Gemini 3.8 Flash (recommended)Paused until about 11:52 AM' +
        'Busy: Google answered 503 UNAVAILABLE at 11:44 AM, after 2 seconds.',
    );
    expect(
      screen.getByText('1 email waiting for AI. It is read by itself when the pause ends.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Sync Gmail/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Read waiting mails now/ }),
    ).not.toBeInTheDocument();
  });

  it('a check while a model is paused does not say "confirmed": the header says it', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(paused);
    vi.mocked(api.checkAIProvider).mockResolvedValue({
      ...paused,
      access: { ...paused.access, lastCheckedAt: at(11, 46) },
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Check key' }));
    expect(await screen.findByText('Key verified · last checked Oct 14, 11:46 AM')).toBeVisible();
    expect(screen.queryByText(/confirmed your key/)).not.toBeInTheDocument();
  });

  it('a check that could not decide names the model and how long we waited', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(ready);
    vi.mocked(api.checkAIProvider).mockResolvedValue({
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
    fireEvent.click(await screen.findByRole('button', { name: 'Check key' }));
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
