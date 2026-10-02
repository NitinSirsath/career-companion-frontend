// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClient, REQUEST_TIMEOUT_MS, api } from '../api/client';
import { routeTree } from '../routeTree.gen';
import {
  getProcessingRefreshUntil,
  resetProcessingRefresh,
  startProcessingRefresh,
} from '../lib/processingRefresh';
import type { ApplicationResponse, GmailStatusResponse, PaginatedResponse } from '../contracts';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      getGmailStatus: vi.fn(), getMessages: vi.fn(), retryEmail: vi.fn(), triggerSync: vi.fn(),
      listApplications: vi.fn(), getApplication: vi.fn(), getApplicationEvents: vi.fn(),
      getApplicationActions: vi.fn(), getActions: vi.fn(), getAmbiguousEmails: vi.fn(), getUnmatchedEmails: vi.fn(), getPendingSubmissions: vi.fn(),
    },
  };
});

const page = <T,>(items: T[]): PaginatedResponse<T> => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });
const status = (lastSyncedAt: string | null): GmailStatusResponse => ({
  connected: true, gmailEmail: 'user@gmail.com', status: 'CONNECTED', syncStatus: 'IDLE', lastSyncedAt,
});
const application = { id: 'app-1', companyName: 'Delayed Co' } as ApplicationResponse;

beforeEach(() => {
  vi.resetAllMocks();
  resetProcessingRefresh();
  vi.mocked(api.getGmailStatus).mockResolvedValue(status('2026-09-01T00:00:00.000Z'));
  vi.mocked(api.getMessages).mockResolvedValue(page([]));
  vi.mocked(api.getApplication).mockResolvedValue(application);
  vi.mocked(api.getApplicationEvents).mockResolvedValue(page([]));
  vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
  vi.mocked(api.listApplications).mockResolvedValue(page([]));
  vi.mocked(api.getActions).mockResolvedValue(page([]));
  vi.mocked(api.getAmbiguousEmails).mockResolvedValue(page([]));
  vi.mocked(api.getUnmatchedEmails).mockResolvedValue(page([]));
  vi.mocked(api.getPendingSubmissions).mockResolvedValue(page([]));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetProcessingRefresh();
});

function show(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }), context: { user: { id: 'u', email: 'u@test.local', name: 'U' } } });
  render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
  return { queryClient, router };
}

describe('authenticated-shell bounded refresh', () => {
  it('does not open a refresh window for the first observed sync time', async () => {
    show('/applications/app-1');
    await screen.findByRole('heading', { name: 'Delayed Co' });
    await waitFor(() => expect(api.getGmailStatus).toHaveBeenCalled());
    expect(getProcessingRefreshUntil()).toBe(0);
  });

  it('refreshes a mounted cached detail when ingestion completes on another route', async () => {
    const { queryClient } = show('/applications/app-1');
    await screen.findByRole('heading', { name: 'Delayed Co' });
    await waitFor(() => expect(api.getGmailStatus).toHaveBeenCalled());
    const before = vi.mocked(api.getApplication).mock.calls.length;
    vi.mocked(api.getGmailStatus).mockResolvedValue(status('2026-09-02T00:00:00.000Z'));
    vi.mocked(api.getApplication).mockResolvedValue({ ...application, companyName: 'Matched Later' });
    await act(() => queryClient.invalidateQueries({ queryKey: ['gmailStatus'] }));
    expect(await screen.findByRole('heading', { name: 'Matched Later' })).toBeInTheDocument();
    expect(vi.mocked(api.getApplication).mock.calls.length).toBeGreaterThan(before);
    expect(getProcessingRefreshUntil()).toBeGreaterThan(Date.now());
  });

  it('opens a window after a manual retry whose response was lost', async () => {
    vi.mocked(api.getMessages).mockResolvedValue(page([{
      id: 'email-1', gmailMessageId: 'm', threadId: null, subject: 'Failed email', sender: 's', receivedAt: null,
      relevanceState: 'UNPROCESSED', matchState: 'UNMATCHED', processingState: 'FAILED',
      processingErrorDetails: 'AI provider rejected request', processingRetryable: false,
    }]));
    vi.mocked(api.retryEmail).mockRejectedValue(new Error('The request timed out. Check your connection and try again.'));
    show('/gmail');
    await screen.findByText('Failed email');
    const trigger = document.querySelector('[data-state], button.cursor-help, .cursor-help') as HTMLElement;
    fireEvent.mouseEnter(trigger); fireEvent.pointerEnter(trigger); fireEvent.focus(trigger);
    fireEvent.click(await screen.findByRole('button', { name: /Manual Retry/ }));
    expect(await screen.findByText(/Retry could not be confirmed/)).toBeInTheDocument();
    expect(getProcessingRefreshUntil()).toBeGreaterThan(Date.now());
  });

  it('refreshes status a minute after the next automatic slot without a hot loop', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.getGmailStatus).mockResolvedValue({ ...status(null), nextScheduledSyncAt: new Date(Date.now() + 10000).toISOString() });
    show('/applications/app-1');
    await screen.findByRole('heading', { name: 'Delayed Co' });
    const before = vi.mocked(api.getGmailStatus).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(69000));
    expect(vi.mocked(api.getGmailStatus).mock.calls.length).toBe(before);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(vi.mocked(api.getGmailStatus).mock.calls.length).toBe(before + 1);
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(vi.mocked(api.getGmailStatus).mock.calls.length).toBe(before + 1);
  });

  it('expires instead of polling forever', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    show('/applications/app-1');
    await screen.findByRole('heading', { name: 'Delayed Co' });
    act(() => startProcessingRefresh(10_000));
    await act(() => vi.advanceTimersByTimeAsync(12_000));
    const settled = vi.mocked(api.getApplication).mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(vi.mocked(api.getApplication).mock.calls.length).toBe(settled);
  });
});

describe('bounded API client', () => {
  it('times out a hung request at the shared deadline', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const pending = new ApiClient().getApplication('app-1');
    const assertion = expect(pending).rejects.toThrow('The request timed out');
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
    vi.unstubAllGlobals();
  });

  it('forwards caller cancellation to fetch', async () => {
    let seen: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      seen = init.signal!;
      return new Promise((_resolve, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    }));
    const controller = new AbortController();
    const pending = new ApiClient().getGmailStatus({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
    expect(seen?.aborted).toBe(true);
    vi.unstubAllGlobals();
  });
});
