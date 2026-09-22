// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
  }
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
      </QueryClientProvider>
    );
  }

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
      metadata: { limit: 50, offset: 0, nextOffset: null }
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

    expect(await screen.findByText('Gmail access was not granted. You can connect Gmail at any time.')).toBeInTheDocument();
  });

  it('displays sync result after successful sync call', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      gmailEmail: 'user@gmail.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
    });

    vi.mocked(api.getMessages).mockResolvedValue({
      items: [],
      metadata: { limit: 50, offset: 0, nextOffset: null }
    });

    vi.mocked(api.triggerSync).mockResolvedValue({
      synced: true,
      messagesIngested: 42,
      messagesSkipped: 7,
      lastSyncedAt: new Date().toISOString()
    });

    renderWithProviders();

    const syncButton = await screen.findByRole('button', { name: 'Sync Now' });
    fireEvent.click(syncButton);

    expect(await screen.findByText('Synced 42 messages (skipped 7)')).toBeInTheDocument();
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
      metadata: { limit: 50, offset: 0, nextOffset: null }
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
    expect(await screen.findByText('Error syncing: A sync is already in progress')).toBeInTheDocument();
    
    // 5. Verify the button is re-enabled because onSettled invalidated the query and fetched IDLE
    expect(await screen.findByRole('button', { name: 'Sync Now' })).not.toBeDisabled();
  });
});
