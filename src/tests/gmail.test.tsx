// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';

// Mock the API client
vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: {
    getGmailStatus: vi.fn(),
    getGmailSummary: vi.fn(),
    getMessages: vi.fn(),
    triggerSync: vi.fn(),
    disconnectGmail: vi.fn(),
    getAISettings: vi.fn(),
  },
}));

import { routeTree } from '../routeTree.gen';
import { FREE_AI_CONSENT } from '../lib/freeAI';
import { makeAISettings } from './fixtures';

const MOCK_USER = { id: 'test-user', email: 'test@test.local', name: 'Test User' };
const SUMMARY = {
  days: 30,
  since: '2026-10-19T00:00:00.000Z',
  checked: 1248,
  jobMails: 37,
  notJobMails: 1205,
  waiting: 6,
  fakeOffers: 1,
  failed: 0,
};

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
    // A Connect Gmail click of an earlier test leaves its mark for the next page.
    sessionStorage.clear();
    // No free AI here unless a test offers it: Connect Gmail works as before.
    vi.mocked(api.getAISettings).mockResolvedValue(
      makeAISettings({ offeredProviders: ['openrouter'], waitingEmails: 0 }),
    );
    vi.mocked(api.getGmailSummary).mockResolvedValue(SUMMARY);
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
      await screen.findByText('Account');
      if (unscannedGap) {
        const notice = screen.getByText(/Mail received between/);
        expect(notice).toHaveTextContent('Thu 1 Jan 2026');
        expect(notice).toHaveTextContent('Thu 15 Jan 2026');
        expect(notice).not.toHaveAttribute('role', 'alert');
      } else expect(screen.queryByText(/Mail received between/)).not.toBeInTheDocument();
      expect(
        screen.getByText(/each sync reads everything since the last one, up to 30 days/),
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
      const line = await screen.findByText(/^Not synced yet · /);
      if (nextScheduledSyncAt) expect(line).toHaveTextContent(/· next sync /);
      else expect(line).toHaveTextContent('Not synced yet · automatic sync is off');
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

    expect(
      await screen.findByText(
        'Gmail is not connected. Connect it so the app can read your job mails.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Gmail' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sync now' })).not.toBeInTheDocument();
    expect(screen.queryByText('Look back')).not.toBeInTheDocument();
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
    expect(screen.getByText('Look back')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeInTheDocument();
    // A summary since 17 Nov 2026: the mail list has its own page.
    expect(screen.getByRole('heading', { name: 'What the app has read' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How your mail is read' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See every mail it read' })).toHaveAttribute(
      'href',
      '/gmail/mails',
    );
    expect(screen.queryByRole('heading', { name: 'Job mails the app has read' })).toBeNull();
    expect(api.getMessages).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: 'Sync' })).not.toBeInTheDocument();
  });
    // What is kept of other mails, as the privacy policy says.
    expect(
      screen.getByText(
        /Other mails are not listed\. For them, the app keeps only Gmail's id, the date and that they are not job mails, for 35 days\./,
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText('No job mails read yet')).toBeInTheDocument();
    // The side menu's Gmail sync, and the way back in the breadcrumb.
    const back = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(back.getByRole('link', { name: 'Gmail sync' })).toHaveAttribute('href', '/gmail');
    expect(screen.queryByRole('tab', { name: 'Not job mails' })).not.toBeInTheDocument();
  });

  it('asks before it disconnects Gmail', async () => {
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
    vi.mocked(api.disconnectGmail).mockResolvedValue({ disconnected: true } as never);
    renderWithProviders();
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));
    expect(await screen.findByText('Disconnect Gmail?')).toBeInTheDocument();
    expect(api.disconnectGmail).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(api.disconnectGmail).toHaveBeenCalledTimes(1));
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

    const syncButton = await screen.findByRole('button', { name: 'Sync now' });
    fireEvent.click(syncButton);

    await waitFor(() => expect(api.triggerSync).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Synced 42/)).not.toBeInTheDocument();
  });

  it('stays busy after a sync is accepted, while the fresh status is still on its way', async () => {
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

    const syncButton = await screen.findByRole('button', { name: 'Sync now' });
    // The status fetched after the start never answers in this test: one slow round trip.
    vi.mocked(api.getGmailStatus).mockReturnValue(new Promise(() => {}));
    const fetchesBefore = vi.mocked(api.getGmailStatus).mock.calls.length;
    fireEvent.click(syncButton);

    await waitFor(() => expect(api.triggerSync).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(vi.mocked(api.getGmailStatus).mock.calls.length).toBeGreaterThan(fetchesBefore),
    );
    expect(screen.getByRole('button', { name: /Syncing/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Sync now' })).not.toBeInTheDocument();
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

    const syncButton = await screen.findByRole('button', { name: 'Sync now' });
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
      await screen.findByText('The sync did not start. Try again in a moment.'),
    ).toBeInTheDocument();

    // 5. Verify the button is re-enabled because onSettled invalidated the query and fetched IDLE
    expect(await screen.findByRole('button', { name: 'Sync now' })).not.toBeDisabled();
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

    renderWithProviders('/gmail/mails');

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

  it('lists job mails with their type, the sender name and a way to link them', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      syncStatus: 'IDLE',
      syncLookbackDays: 1,
      status: 'CONNECTED',
      gmailEmail: 'test@example.com',
      lastSyncedAt: null,
    });
    const mail = {
      gmailMessageId: 'msg1',
      receivedAt: new Date().toISOString(),
      processingState: 'COMPLETED' as const,
      relevanceState: 'RELEVANT' as const,
      matchState: 'UNMATCHED' as const,
    };
    vi.mocked(api.getMessages).mockResolvedValue({
      items: [
        {
          ...mail,
          id: 'job-msg',
          threadId: 'thread-1',
          subject: 'Interview on Friday',
          sender: 'Priya Nair <priya@acme.example>',
          category: 'INTERVIEW',
        },
        {
          ...mail,
          id: 'new-msg',
          gmailMessageId: 'msg2',
          threadId: null,
          subject: 'Thanks for applying',
          sender: 'careers@acme.example',
          processingState: 'PENDING',
          relevanceState: 'UNPROCESSED',
          category: null,
        },
      ],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders('/gmail/mails');

    expect(await screen.findByText('Interview on Friday')).toBeInTheDocument();
    expect(api.getMessages).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(screen.getByText('Interview')).toBeInTheDocument();
    expect(screen.getByText('Not read yet')).toBeInTheDocument();
    // The name only; the whole From line on hover.
    expect(screen.getByText('Priya Nair')).toHaveAttribute(
      'title',
      'Priya Nair <priya@acme.example>',
    );
    // A job mail with no application opens its conversation, where it can be linked.
    expect(screen.getByRole('link', { name: 'Open in Mails' })).toHaveAttribute(
      'href',
      '/mails/thread-1',
    );
    expect(screen.getAllByRole('link', { name: 'Open in Mails' })).toHaveLength(1);
  });

  describe('connecting Gmail with the free AI (owner, 15 Nov 2026)', () => {
    const notConnected = {
      connected: false,
      gmailEmail: null,
      status: 'NOT_CONNECTED' as const,
      syncStatus: 'IDLE' as const,
      lastSyncedAt: null,
    };

    it('says the free AI reads the mails, and connects with it back to the Dashboard', async () => {
      vi.mocked(api.getGmailStatus).mockResolvedValue(notConnected);
      vi.mocked(api.getAISettings).mockResolvedValue(makeAISettings());
      renderWithProviders();
      expect(
        await screen.findByText(/Your job mails are read by NorthList's free AI/),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Connect Gmail' }));
      expect(window.location.href).toBe(
        `/api/gmail/connect?returnTo=%2Fdashboard&freeAI=${encodeURIComponent(FREE_AI_CONSENT)}`,
      );
    });

    it('says nothing about the AI before Gmail is connected', async () => {
      vi.mocked(api.getGmailStatus).mockResolvedValue(notConnected);
      vi.mocked(api.getAISettings).mockResolvedValue(makeAISettings());
      renderWithProviders();
      expect(await screen.findByRole('button', { name: 'Connect Gmail' })).toBeInTheDocument();
      await waitFor(() => expect(api.getAISettings).toHaveBeenCalled());
      expect(screen.queryByText('AI is not set up')).not.toBeInTheDocument();
    });

    it('a user who already has an AI connects Gmail as before', async () => {
      vi.mocked(api.getGmailStatus).mockResolvedValue(notConnected);
      vi.mocked(api.getAISettings).mockResolvedValue(
        makeAISettings({
          connections: [
            {
              provider: 'openrouter',
              active: true,
              state: 'READY',
              reason: null,
              modelId: null,
              failure: null,
              models: null,
              verified: true,
              lastCheckedAt: null,
              consentCurrent: true,
            },
          ],
        }),
      );
      renderWithProviders();
      fireEvent.click(await screen.findByRole('button', { name: 'Connect Gmail' }));
      expect(window.location.href).toBe('/api/gmail/connect');
      expect(screen.queryByText(/read by NorthList's free AI/)).not.toBeInTheDocument();
    });
  });
});
