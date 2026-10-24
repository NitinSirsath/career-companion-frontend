// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { AIConnection, AISettingsResponse } from '../contracts/ai';

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
import { FREE_AI_CONSENT } from '../lib/freeAI';

const MOCK_USER = { id: 'u', email: 'test@test.local', name: 'Test' };
const LUNA = { id: 'openai/gpt-6-luna', source: 'RECOMMENDED' as const };

const nothing: AISettingsResponse = {
  configured: false,
  provider: null,
  offeredProviders: ['openrouter', 'career-companion'],
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
  usageToday: { day: '2026-10-24', calls: 0, inputTokens: 0, outputTokens: 0 },
  safetyLimit: { callsPerDay: 250, resetsAt: '2026-10-25T00:00:00.000Z' },
  waitingEmails: 12,
  needsYourOk: { emails: 0, model: null, lastTriedAt: null, tries: 0 },
  consent: null,
  connections: [],
};
const freeConnection: AIConnection = {
  provider: 'career-companion',
  active: true,
  state: 'READY',
  reason: null,
  modelId: null,
  failure: null,
  models: { fast: LUNA, detailed: LUNA },
  verified: true,
  lastCheckedAt: '2026-10-24T09:00:00.000Z',
  consentCurrent: true,
};
const freeActive: AISettingsResponse = {
  ...nothing,
  configured: true,
  provider: 'career-companion',
  models: { fast: LUNA, detailed: LUNA },
  access: { ...nothing.access, state: 'READY', reason: null, verified: true },
  usageToday: { day: '2026-10-24', calls: 41, inputTokens: 0, outputTokens: 0 },
  waitingEmails: 0,
  consent: {
    disclosure: FREE_AI_CONSENT,
    consentedAt: '2026-10-24T09:00:00.000Z',
    current: true,
  },
  connections: [freeConnection],
};
/** The free AI's pause shared by everyone, with this reason. */
const freePaused = (reason: 'FREE_AI_BUSY' | 'FREE_AI_BUDGET' | 'FREE_AI_PROBLEM') => ({
  ...freeActive,
  waitingEmails: 12,
  access: {
    ...freeActive.access,
    state: 'LIMITED' as const,
    reason,
    modelId: LUNA.id,
    resumesAt: '2026-10-24T10:42:00.000Z',
  },
  connections: [{ ...freeConnection, state: 'LIMITED' as const, reason }],
});
const ownKey: AIConnection = {
  ...freeConnection,
  provider: 'openrouter',
};
/** The user's own OpenRouter key reads the mail. */
const ownKeyWorks: AISettingsResponse = {
  ...freeActive,
  provider: 'openrouter',
  consent: null,
  connections: [ownKey],
};
/** The user's own OpenRouter key was refused. */
const ownKeyRefused: AISettingsResponse = {
  ...freeActive,
  provider: 'openrouter',
  access: {
    ...freeActive.access,
    state: 'NEEDS_ATTENTION',
    reason: 'KEY_REJECTED',
  },
  consent: null,
  connections: [{ ...ownKey, state: 'NEEDS_ATTENTION', reason: 'KEY_REJECTED' }],
};

let queryClient: QueryClient;

function renderPage(settings: AISettingsResponse, path = '/ai') {
  vi.mocked(api.getAISettings).mockResolvedValue(settings);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: MOCK_USER },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

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
});
afterEach(() => vi.restoreAllMocks());

describe('a new user chooses how mails are read', () => {
  it('shows their own key as recommended and the free AI as the other choice', async () => {
    renderPage(nothing);
    expect(
      await screen.findByText('Gmail is connected. One more step: choose how your mails are read.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose how your mails are read' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Use your own AI key' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'NorthList free AI' })).toBeVisible();
    expect(screen.getByText('Recommended')).toBeVisible();
    // The cards are the actions: no second "Connect a provider" in the header.
    expect(screen.getAllByRole('button', { name: 'Connect a provider' })).toHaveLength(1);
  });

  it('lists only providers with a key of their own when connecting a key', async () => {
    renderPage(nothing);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect a provider' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('OpenRouter')).toBeInTheDocument();
    expect(within(dialog).queryByText('NorthList free AI')).not.toBeInTheDocument();
  });

  it('connects the free AI only after the user agrees, with no key', async () => {
    vi.mocked(api.saveAIProvider).mockResolvedValue({
      ...freeActive,
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage(nothing);
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    const dialog = await screen.findByRole('dialog', { name: 'Use NorthList free AI?' });
    for (const term of ['What is sent', 'Who reads it', 'Shared', 'Daily limit', 'Budget'])
      expect(within(dialog).getByText(term)).toBeInTheDocument();
    const use = within(dialog).getByRole('button', { name: 'Use free AI' });
    expect(use).toBeDisabled();
    fireEvent.click(
      within(dialog).getByLabelText(
        'I agree that my mails are sent to OpenRouter as described above.',
      ),
    );
    fireEvent.click(use);
    await waitFor(() =>
      expect(api.saveAIProvider).toHaveBeenCalledWith('career-companion', {
        consentDisclosure: FREE_AI_CONSENT,
        makeActive: true,
      }),
    );
    expect(await screen.findByText('NorthList free AI reads your mail now.')).toBeInTheDocument();
  });
});

describe('the free AI reads the mail', () => {
  it('shows it is shared, with GPT-6 Luna fixed and no key or model to change', async () => {
    renderPage(freeActive);
    expect(await screen.findAllByText('Fixed on the free AI')).toHaveLength(2);
    expect(screen.getByText('The free AI is shared by everyone,')).toBeInTheDocument();
    expect(screen.getAllByText('GPT-6 Luna')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Check key' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace key' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'No other provider yet. Your own key reads mails faster, because nobody else shares it.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/The free AI reads about 200 mails a day for you/)).toBeVisible();
  });

  it.each([
    ['FREE_AI_BUSY', 'The free AI is busy right now.'],
    ['FREE_AI_BUDGET', "The free AI is paused: this month's free budget is used up."],
    ['FREE_AI_PROBLEM', "The free AI is paused: a problem on NorthList's side."],
  ] as const)('%s: says it waits by itself and offers the own key', async (reason, title) => {
    renderPage(freePaused(reason));
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText(/Your 12 new mails are waiting/)).toBeInTheDocument();
    expect(screen.getByText('Paused')).toBeInTheDocument();
    expect(screen.queryByText('The free AI is shared by everyone,')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Connect your own key' })).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: 'Read waiting mails now' }),
    ).not.toBeInTheDocument();
  });

  it('removes it without speaking of a key', async () => {
    renderPage(freeActive);
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove NorthList free AI?' });
    expect(within(dialog).getByText(/stops reading your mail with the free AI/)).toBeVisible();
  });
});

describe('a key of their own and the free AI', () => {
  it("offers the free AI when the user's own key fails", async () => {
    renderPage(ownKeyRefused);
    fireEvent.click(await screen.findByRole('button', { name: 'Use NorthList free AI instead' }));
    expect(
      await screen.findByRole('dialog', { name: 'Use NorthList free AI?' }),
    ).toBeInTheDocument();
    expect(api.activateAIProvider).not.toHaveBeenCalled();
  });

  it('offers the free AI as a backup next to a working key, and adds it without switching', async () => {
    vi.mocked(api.saveAIProvider).mockResolvedValue({
      ...ownKeyWorks,
      connections: [ownKey, { ...freeConnection, active: false }],
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage(ownKeyWorks);
    const list = await screen.findByRole('list', { name: 'Other connected providers' });
    expect(within(list).getByText('Free, shared by everyone. No key needed.')).toBeVisible();
    expect(
      within(list).getByText('GPT-6 Luna for both steps · about 200 mails a day'),
    ).toBeVisible();
    expect(screen.queryByText(/No other provider yet/)).not.toBeInTheDocument();
    fireEvent.click(within(list).getByRole('button', { name: 'Add as backup' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add NorthList free AI?' });
    const add = within(dialog).getByRole('button', { name: 'Add free AI' });
    expect(add).toBeDisabled();
    expect(
      within(dialog).getByLabelText(
        'Make NorthList free AI active now. It then reads new mails instead of OpenRouter.',
      ),
    ).not.toBeChecked();
    fireEvent.click(
      within(dialog).getByLabelText(
        'I agree that my mails are sent to OpenRouter as described above.',
      ),
    );
    fireEvent.click(add);
    await waitFor(() =>
      expect(api.saveAIProvider).toHaveBeenCalledWith('career-companion', {
        consentDisclosure: FREE_AI_CONSENT,
        makeActive: false,
      }),
    );
    expect(
      await screen.findByText('NorthList free AI is added. OpenRouter still reads your mail.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add as backup' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make active' })).toBeInTheDocument();
  });

  it('switches to the free AI at once when the user ticks "Make … active now"', async () => {
    vi.mocked(api.saveAIProvider).mockResolvedValue({
      ...freeActive,
      connections: [freeConnection, { ...ownKey, active: false }],
      verification: 'VERIFIED',
      verificationFailure: null,
    });
    renderPage(ownKeyWorks);
    fireEvent.click(await screen.findByRole('button', { name: 'Add as backup' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add NorthList free AI?' });
    fireEvent.click(
      within(dialog).getByLabelText(
        'I agree that my mails are sent to OpenRouter as described above.',
      ),
    );
    fireEvent.click(within(dialog).getByLabelText(/Make NorthList free AI active now/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use free AI' }));
    await waitFor(() =>
      expect(api.saveAIProvider).toHaveBeenCalledWith('career-companion', {
        consentDisclosure: FREE_AI_CONSENT,
        makeActive: true,
      }),
    );
    expect(await screen.findByText('NorthList free AI reads your mail now.')).toBeInTheDocument();
  });

  it('offers no backup when the server does not offer the free AI', async () => {
    renderPage({ ...ownKeyWorks, offeredProviders: ['openrouter'] });
    expect(
      await screen.findByText(
        'No other provider yet. A second one lets you switch quickly when this one has a problem.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add as backup' })).not.toBeInTheDocument();
  });

  it('lists a connected free AI like any provider, with nothing to check or replace', async () => {
    renderPage({
      ...ownKeyRefused,
      access: { ...freeActive.access },
      connections: [ownKey, { ...freeConnection, active: false }],
    });
    const list = await screen.findByRole('list', { name: 'Other connected providers' });
    expect(within(list).getByText('Free, shared by everyone. No key needed.')).toBeVisible();
    expect(within(list).getByText(/GPT-6 Luna for both steps/)).toBeVisible();
    fireEvent.click(within(list).getByRole('button', { name: 'More for NorthList free AI' }));
    expect(await screen.findByRole('menuitem', { name: 'Remove…' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Check key' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Replace key' })).not.toBeInTheDocument();
  });
});

describe('right after Gmail is connected', () => {
  it('a user with no AI provider goes on to choose one', async () => {
    sessionStorage.setItem('career-companion-gmail-connect', 'started');
    const router = renderPage(nothing, '/gmail');
    await waitFor(() => expect(router.state.location.pathname).toBe('/ai'));
    expect(
      await screen.findByRole('heading', { name: 'Choose how your mails are read' }),
    ).toBeVisible();
    expect(sessionStorage.getItem('career-companion-gmail-connect')).toBeNull();
  });

  it('a user who has one stays on the Gmail page', async () => {
    sessionStorage.setItem('career-companion-gmail-connect', 'started');
    const router = renderPage(freeActive, '/gmail');
    await waitFor(() => expect(api.getAISettings).toHaveBeenCalled());
    await waitFor(() =>
      expect(sessionStorage.getItem('career-companion-gmail-connect')).toBeNull(),
    );
    expect(router.state.location.pathname).toBe('/gmail');
  });

  it('a later visit to the Gmail page stays there', async () => {
    const router = renderPage(nothing, '/gmail');
    expect(await screen.findByRole('heading', { name: 'Gmail sync' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/gmail');
  });
});
