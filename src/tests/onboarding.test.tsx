// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { User } from '../api/auth';
import type { AIReadingStatusResponse } from '../contracts/ai';
import {
  aiProgress,
  markOnboardingFinished,
  nextStep,
  onboardingOpen,
  resetOnboardingForTests,
  shownStep,
  stepCount,
  stepsFor,
} from '../lib/onboarding';
import { FREE_AI_CONSENT } from '../lib/freeAI';
import { resetInstallForTests, startInstallWatch } from '../lib/install';
import { transition } from '../lib/viewTransition';
import { makeAISettings } from './fixtures';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
      getDashboard: vi.fn(),
      getGmailStatus: vi.fn(),
      getAIReading: vi.fn(),
      getAISettings: vi.fn(),
    },
  };
});

import { routeTree } from '../routeTree.gen';

const ALL = stepsFor({ install: true, alerts: true });
const LAPTOP_FIREFOX = stepsFor({ install: false, alerts: false });

describe('the first run steps', () => {
  afterEach(resetOnboardingForTests);

  it('leaves out Install and Alerts where this device cannot do them', () => {
    expect(ALL).toEqual(['welcome', 'gmail', 'install', 'alerts', 'theme', 'tour', 'ai', 'done']);
    expect(LAPTOP_FIREFOX).toEqual(['welcome', 'gmail', 'theme', 'tour', 'ai', 'done']);
  });

  it('opens a step saved on another device at the next one this device has', () => {
    expect(shownStep(LAPTOP_FIREFOX, 'install')).toBe('theme');
    expect(shownStep(LAPTOP_FIREFOX, 'alerts')).toBe('theme');
    expect(shownStep(ALL, 'alerts')).toBe('alerts');
  });

  it('moves one step and stops at the first and the last', () => {
    expect(nextStep(LAPTOP_FIREFOX, 'gmail', 1)).toBe('theme');
    expect(nextStep(LAPTOP_FIREFOX, 'theme', -1)).toBe('gmail');
    expect(nextStep(ALL, 'welcome', -1)).toBe('welcome');
    expect(nextStep(ALL, 'done', 1)).toBe('done');
    expect(nextStep(LAPTOP_FIREFOX, 'install', 1)).toBe('tour');
  });

  it('counts the steps between Welcome and Done', () => {
    expect(stepCount(ALL, 'gmail')).toEqual({ number: 1, of: 6, name: 'Gmail' });
    expect(stepCount(LAPTOP_FIREFOX, 'ai')).toEqual({ number: 4, of: 4, name: 'Your AI' });
    expect(stepCount(ALL, 'welcome')).toBeNull();
    expect(stepCount(ALL, 'done')).toBeNull();
  });

  it('is open only for a user with a step, until finished on this page', () => {
    expect(onboardingOpen(null)).toBe(false);
    expect(onboardingOpen({ onboarding: null })).toBe(false);
    expect(onboardingOpen({ onboarding: { step: 'tour' } })).toBe(true);
    markOnboardingFinished();
    expect(onboardingOpen({ onboarding: { step: 'tour' } })).toBe(false);
  });

  it('ticks the AI steps: getting the folder, copying the prompt, the first use', () => {
    expect(aiProgress(false, false, false)).toBe(0);
    expect(aiProgress(true, false, false)).toBe(1);
    expect(aiProgress(false, true, false)).toBe(3);
    expect(aiProgress(true, true, true)).toBe(4);
  });
});

describe('step changes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'startViewTransition');
  });
  const motion = (reduce: boolean) =>
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: reduce && query === '(prefers-reduced-motion: reduce)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));

  it('slide with a view transition typed by direction, where the browser has them', () => {
    motion(false);
    const done = Promise.resolve();
    const start = vi.fn((options: { update: () => void }) => {
      options.update();
      return { ready: done, finished: done, updateCallbackDone: done };
    });
    Object.assign(document, { startViewTransition: start });
    const update = vi.fn();
    transition(update, 'backward');
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ types: ['backward'] }));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('change at once with Reduce Motion, and where there are no view transitions', () => {
    motion(true);
    const start = vi.fn();
    Object.assign(document, { startViewTransition: start });
    const update = vi.fn();
    expect(transition(update, 'forward')).toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    Reflect.deleteProperty(document, 'startViewTransition');
    motion(false);
    expect(transition(update, 'forward')).toBeNull();
    expect(update).toHaveBeenCalledTimes(2);
  });
});

const notConnected = {
  connected: false,
  gmailEmail: null,
  status: null,
  syncStatus: null,
  lastSyncedAt: null,
};
const reading: AIReadingStatusResponse = {
  state: 'READING',
  reason: null,
  provider: 'career-companion',
  model: null,
  notDone: 30,
  done: 12,
  total: 42,
  inLine: false,
  secondsLeft: 170,
  resumesAt: null,
  steps: [
    {
      emailId: '11111111-1111-4111-8111-111111111111',
      subject: 'Interview invitation: Frontend Engineer',
      step: 'JOB',
      provider: 'career-companion',
      model: null,
      category: 'INTERVIEW',
      companyName: 'Brightwave',
      jobTitle: null,
      at: '2026-11-22T10:00:00.000Z',
    },
    {
      emailId: '22222222-2222-4222-8222-222222222222',
      subject: null,
      step: 'NOT_JOB',
      provider: 'career-companion',
      model: null,
      category: null,
      companyName: null,
      jobTitle: null,
      at: '2026-11-22T10:00:01.000Z',
    },
  ],
  jobMails: { count: 1, newest: [] },
};
const profile = (step: string | null) => ({
  id: '11111111-1111-4111-8111-111111111111',
  email: 'new@example.com',
  name: 'New',
  hasPassword: true,
  hasGoogle: false,
  testAccount: false,
  admin: false,
  suspension: null,
  onboarding: step ? { step } : null,
});

function renderApp(user: User, path = '/dashboard') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const newUser = (step: User['onboarding'] = { step: 'welcome' }): User => ({
  id: 'u',
  email: 'new@example.com',
  name: 'New',
  onboarding: step,
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 404 })),
  );
  vi.mocked(api.getGmailStatus).mockResolvedValue(notConnected);
  vi.mocked(api.getAIReading).mockResolvedValue({ ...reading, state: 'NONE', steps: [] });
  vi.mocked(api.getAISettings).mockResolvedValue(makeAISettings());
  // The server has no alert keys here, so the Alerts step is left out.
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path === '/api/alerts/key') return { available: false };
    throw new Error(`unexpected GET ${path}`);
  });
  vi.mocked(api.post).mockImplementation(async (path: string, body?: unknown) => {
    if (path === '/api/auth/onboarding') return profile((body as { step: string }).step);
    if (path === '/api/auth/onboarding/finish') return profile(null);
    throw new Error(`unexpected POST ${path}`);
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  resetOnboardingForTests();
});

describe('the first run page', () => {
  it('opens for a new account instead of any other page, full screen', async () => {
    const router = renderApp(newUser(), '/mails');
    expect(
      await screen.findByRole('heading', { name: 'Every job mail, sorted for you.' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/welcome');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('never opens for an existing account: its address leads to the Dashboard', async () => {
    const router = renderApp(newUser(null), '/welcome');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('continues at the step the user reached', async () => {
    renderApp(newUser({ step: 'theme' }));
    expect(await screen.findByRole('heading', { name: 'Pick your look' })).toBeInTheDocument();
    // Alerts drop out once the server says it has no alert keys.
    expect(await screen.findByText(/Step 2 of 4 · Theme/)).toBeInTheDocument();
  });

  it('saves each step, and Skip goes past Gmail; steps this browser cannot do are left out', async () => {
    renderApp(newUser());
    fireEvent.click(await screen.findByRole('button', { name: 'Get started' }));
    expect(await screen.findByRole('heading', { name: 'Connect your Gmail' })).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/api/auth/onboarding', { step: 'gmail' });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(await screen.findByRole('heading', { name: 'Pick your look' })).toBeInTheDocument();
    expect(api.post).toHaveBeenLastCalledWith('/api/auth/onboarding', { step: 'theme' });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Connect your Gmail' })).toBeInTheDocument();
  });

  it('connects Gmail with the free AI and comes back to the first run', async () => {
    vi.mocked(api.getAISettings).mockResolvedValue(
      makeAISettings({ offeredProviders: ['career-companion'] }),
    );
    renderApp(newUser({ step: 'gmail' }));
    expect(
      await screen.findByText(/Your job mails are read by NorthList's free AI, through OpenRouter/),
    ).toBeInTheDocument();
    vi.stubGlobal('location', { href: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Connect Gmail' }));
    expect(window.location.href).toBe(
      `/api/gmail/connect?returnTo=%2Fwelcome&freeAI=${encodeURIComponent(FREE_AI_CONSENT)}`,
    );
  });

  it('walks through the four "How it works" cards with Next', async () => {
    renderApp(newUser({ step: 'tour' }));
    expect(await screen.findByRole('heading', { name: 'How NorthList works' })).toBeInTheDocument();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: /Reply with AI/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByRole('heading', { name: 'Apply to jobs with your AI' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Antigravity/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('shows the AI reading on Done, and Open Dashboard ends the first run', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      ...notConnected,
      connected: true,
      gmailEmail: 'new@example.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
    });
    vi.mocked(api.getAIReading).mockResolvedValue(reading);
    const router = renderApp(newUser({ step: 'done' }));
    expect(await screen.findByText('The AI is reading your mails')).toBeInTheDocument();
    expect(
      screen.getByText('12 of 42 done · about 3 min left · read by NorthList free AI'),
    ).toBeInTheDocument();
    expect(screen.getByText('Interview · Brightwave')).toBeInTheDocument();
    expect(screen.getByText('Not a job mail · skipped')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Dashboard' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(api.post).toHaveBeenCalledWith('/api/auth/onboarding/finish');
  });

  it('offers Connect Gmail again on Done when it was skipped', async () => {
    renderApp(newUser({ step: 'done' }));
    expect(await screen.findByRole('button', { name: 'Connect Gmail now' })).toBeInTheDocument();
    expect(screen.getByText(/Or later from Today/)).toBeInTheDocument();
  });

  it('shows Install where the browser offers it; Install opens the browser box', async () => {
    startInstallWatch();
    const prompt = vi.fn(async () => undefined);
    const offer = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(offer, { prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) });
    act(() => {
      window.dispatchEvent(offer);
    });
    renderApp(newUser({ step: 'install' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Install app' }));
    expect(await screen.findByText('Installed')).toBeInTheDocument();
    expect(prompt).toHaveBeenCalledTimes(1);
    resetInstallForTests();
    localStorage.clear();
  });
});
