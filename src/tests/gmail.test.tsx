// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    getGmailStatus: vi.fn(),
    getMessages: vi.fn(),
    triggerSync: vi.fn(),
    disconnectGmail: vi.fn(),
  },
}));

import { routeTree } from '../routeTree.gen';

const MOCK_USER = { id: 'test-user', email: 'test@test.local', name: 'Test User' };

function createTestRouter(initialPath = '/gmail') {
  const history = createMemoryHistory({
    initialEntries: [initialPath],
  });
  // Pass a mock authenticated user so the root route's beforeLoad doesn't redirect to /login
  return createRouter({ routeTree, history, context: { user: MOCK_USER } });
}

describe('Gmail Route', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Mock window.location.href
    delete (window as any).location;
    window.location = { href: '' } as any;
  });

  function renderWithProviders(initialPath = '/gmail') {
    const router = createTestRouter(initialPath);
    return render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  }

  it.each([null, undefined, { from: '2026-01-01T12:00:00Z', until: '2026-01-15T12:00:00Z' }])(
    'shows only a recorded capped gap: %s',
    async (unscannedGap) => {
      vi.mocked(api.getGmailStatus).mockResolvedValue({
        connected: true,
        gmailEmail: 'user@gmail.com',
        status: 'CONNECTED',
        syncStatus: 'IDLE',
        lastSyncedAt: null,
        unscannedGap,
      });
      vi.mocked(api.getMessages).mockResolvedValue({
        items: [],
        metadata: { limit: 20, offset: 0, nextOffset: null },
      });
      renderWithProviders();
      await screen.findByText('Email Sync');
      if (unscannedGap) {
        const notice = screen.getByText(/Mail received between/);
        expect(notice).toHaveTextContent('Jan 1, 2026');
        expect(notice).toHaveTextContent('Jan 15, 2026');
        expect(notice).not.toHaveAttribute('role', 'alert');
      } else expect(screen.queryByText(/Mail received between/)).not.toBeInTheDocument();
      expect(
        screen.getByText(/each sync covers everything since the last successful sync/),
      ).toBeInTheDocument();
    },
  );

  it.each([null, undefined, '2026-10-03T12:30:00Z'])(
    'shows the next automatic sync or off: %s',
    async (nextScheduledSyncAt) => {
      vi.mocked(api.getGmailStatus).mockResolvedValue({
        connected: true,
        gmailEmail: 'user@gmail.com',
        status: 'CONNECTED',
        syncStatus: 'IDLE',
        lastSyncedAt: null,
        nextScheduledSyncAt,
      });
      vi.mocked(api.getMessages).mockResolvedValue({
        items: [],
        metadata: { limit: 20, offset: 0, nextOffset: null },
      });
      renderWithProviders();
      if (nextScheduledSyncAt)
        expect(await screen.findByText(/Next automatic sync:/)).toBeInTheDocument();
      else expect(await screen.findByText('Automatic sync is off.')).toBeInTheDocument();
    },
  );

  it('renders "not connected" state correctly', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: false,
      gmailEmail: null,
      status: 'NOT_CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });

    renderWithProviders();

    expect(await screen.findByText('Connection Status')).toBeInTheDocument();
    expect(screen.getByText('Gmail not connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Gmail' })).toBeInTheDocument();
    expect(screen.queryByText('Email Sync')).not.toBeInTheDocument();
  });

  it('renders "connected" state correctly', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      gmailEmail: 'user@gmail.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });

    vi.mocked(api.getMessages).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders();

    expect(await screen.findByText('Connected as')).toBeInTheDocument();
    expect(screen.getByText('user@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    expect(screen.getByText('Email Sync')).toBeInTheDocument();
  });

  it('navigates to /api/gmail/connect when Connect Gmail is clicked', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: false,
      gmailEmail: null,
      status: 'NOT_CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });

    renderWithProviders();

    const button = await screen.findByRole('button', { name: 'Connect Gmail' });
    fireEvent.click(button);

    expect(window.location.href).toBe('/api/gmail/connect');
  });

  it('displays the denial message when ?gmailError=denied', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: false,
      gmailEmail: null,
      status: 'NOT_CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });

    renderWithProviders('/gmail?gmailError=denied');

    expect(
      await screen.findByText('Gmail connection did not complete. Please try again.'),
    ).toBeInTheDocument();
  });

  it('waits for background status after a sync is accepted', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      gmailEmail: 'user@gmail.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });

    vi.mocked(api.getMessages).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    vi.mocked(api.triggerSync).mockResolvedValue({ accepted: true });

    renderWithProviders();

    const syncButton = await screen.findByRole('button', { name: 'Sync Now' });
    fireEvent.click(syncButton);

    await waitFor(() => expect(api.triggerSync).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Synced 42/)).not.toBeInTheDocument();
  });

  it('re-enables sync button after triggerSync fails (e.g. timeout or 409) via onSettled invalidation', async () => {
    // 1. Initial state: connected, IDLE
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      gmailEmail: 'user@gmail.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });

    vi.mocked(api.getMessages).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders();

    const syncButton = await screen.findByRole('button', { name: 'Sync Now' });
    expect(syncButton).not.toBeDisabled();

    // 2. Setup triggerSync to fail (simulate timeout or 409)
    vi.mocked(api.triggerSync).mockRejectedValue(new Error('A sync is already in progress'));

    // Setup the SUBSEQUENT getGmailStatus to return IDLE
    // (meaning the backend finally finished, and we want to ensure the UI recovers)
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      gmailEmail: 'user@gmail.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });

    // 3. Click sync
    fireEvent.click(syncButton);

    // 4. Verify it recovers and shows error
    expect(
      await screen.findByText('Error syncing: A sync is already in progress'),
    ).toBeInTheDocument();

    // 5. Verify the button is re-enabled because onSettled invalidated the query and fetched IDLE
    expect(await screen.findByRole('button', { name: 'Sync Now' })).not.toBeDisabled();
  });

  it('renders a Gmail link when threadId is provided', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      gmailEmail: 'user@gmail.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });

    vi.mocked(api.getMessages).mockResolvedValue({
      items: [
        {
          id: '1',
          gmailMessageId: 'msg-1',
          threadId: 'thread-123',
          subject: 'Email with threadId',
          sender: 'sender@test.com',
          receivedAt: new Date().toISOString(),
          relevanceState: 'UNPROCESSED',
          matchState: 'UNMATCHED',
        },
        {
          id: '2',
          gmailMessageId: 'msg-2',
          threadId: null, // No thread ID
          subject: 'Email without threadId',
          sender: 'sender@test.com',
          receivedAt: new Date().toISOString(),
          relevanceState: 'UNPROCESSED',
          matchState: 'UNMATCHED',
        },
      ],
      metadata: { limit: 50, offset: 0, nextOffset: null },
    });

    renderWithProviders();

    // The first email should be a link
    const link = await screen.findByRole('link', {
      name: /Open email "Email with threadId" in Gmail/i,
    });
    expect(link).toHaveAttribute('href', 'https://mail.google.com/mail/u/0/#all/thread-123');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');

    // The second email should NOT be a link (just text)
    expect(screen.getByText('Email without threadId')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Open email "Email without threadId" in Gmail/i }),
    ).not.toBeInTheDocument();
  });

  it('switches between Job Related and Irrelevant tabs and filters correctly', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      syncStatus: 'IDLE',
      syncLookbackDays: 1,
      status: 'CONNECTED',
      gmailEmail: 'test@example.com',
      lastSyncedAt: null,
    });
    vi.mocked(api.getMessages).mockImplementation(async (params) => {
      if (params?.relevance === 'irrelevant') {
        return { items: [], metadata: { limit: 20, offset: 0, nextOffset: null } };
      }
      return {
        items: [
          {
            id: 'job-msg',
            gmailMessageId: 'msg1',
            threadId: null,
            subject: 'Job Alert',
            sender: 'jobs@linkedin.com',
            receivedAt: new Date().toISOString(),
            processingState: 'COMPLETED',
            relevanceState: 'RELEVANT',
            matchState: 'UNMATCHED',
          },
        ],
        metadata: { limit: 20, offset: 0, nextOffset: null },
      };
    });

    renderWithProviders();

    // Default tab should be job_related and show the job alert
    expect(await screen.findByText('Job Alert')).toBeInTheDocument();
    expect(api.getMessages).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      relevance: 'job_related',
    });

    // Switch to irrelevant tab
    const irrelevantTab = screen.getByRole('button', { name: /Irrelevant/i });
    fireEvent.click(irrelevantTab);

    // Empty state for irrelevant tab
    expect(await screen.findByText('No irrelevant emails found.')).toBeInTheDocument();
    expect(api.getMessages).toHaveBeenCalledWith({ limit: 20, offset: 0, relevance: 'irrelevant' });
  });
});
