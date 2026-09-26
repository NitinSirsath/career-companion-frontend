// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApplicationResponse, ApplicationEventResponse, ApplicationActionResponse } from '../contracts/application';

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    listApplications: vi.fn(),
    getApplication: vi.fn(),
    createApplication: vi.fn(),
    getApplicationEvents: vi.fn(),
    getApplicationActions: vi.fn(),
    getGmailStatus: vi.fn(),
    getMessages: vi.fn(),
    triggerSync: vi.fn(),
    disconnectGmail: vi.fn(),
  }
}));

import { routeTree } from '../routeTree.gen';

// ─── Helper factories ─────────────────────────────────────────────────────────

function makeApp(overrides: Partial<ApplicationResponse> = {}): ApplicationResponse {
  return {
    id: 'app-1',
    companyName: 'Acme Corp',
    jobTitle: 'Senior Engineer',
    location: 'Remote',
    aiStatus: null,
    userStatus: 'APPLIED',
    userStatusSetAt: null,
    appliedAt: '2026-01-15T00:00:00Z',
    createdAt: '2026-01-15T00:00:00Z',
    updatedAt: '2026-01-15T00:00:00Z',
    recentEvent: null,
    pendingActionCount: 0,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<ApplicationEventResponse> = {}): ApplicationEventResponse {
  return {
    id: 'evt-1',
    applicationId: 'app-1',
    emailId: null,
    type: 'EMAIL_PROCESSED',
    oldState: null,
    newState: 'RECRUITER_CONTACT',
    description: 'Received recruiter email',
    provenance: null,
    createdAt: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

function makeAction(overrides: Partial<ApplicationActionResponse> = {}): ApplicationActionResponse {
  return {
    id: 'act-1',
    applicationId: 'app-1',
    emailId: null,
    type: 'ACTION_REQUIRED',
    description: 'Submit portfolio',
    deadline: '2026-02-15T00:00:00Z',
    status: 'PENDING',
    createdAt: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

// ─── Test setup helpers ───────────────────────────────────────────────────────

const MOCK_USER = { id: 'test-user', email: 'test@test.local', name: 'Test User' };

function createTestRouter(initialPath: string) {
  const history = createMemoryHistory({ initialEntries: [initialPath] });
  // Pass a mock authenticated user so the root route's beforeLoad doesn't redirect to /login
  return createRouter({ routeTree, history, context: { user: MOCK_USER } });
}

function renderWithProviders(queryClient: QueryClient, initialPath: string) {
  const router = createTestRouter(initialPath);
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

// ─── Applications Dashboard tests ─────────────────────────────────────────────

import { afterEach } from 'vitest';

describe('Applications Dashboard (/applications)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getApplication).mockResolvedValue(makeApp());
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    cleanup();
  });

  // ─── UX hierarchy ──────────────────────────────────────────────────────────

  it('does NOT show the create form by default (form is hidden on load)', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    // Form heading should not be visible until toggled
    // Use findByText first to ensure the page has loaded
    await screen.findByText(/no applications yet/i);
    expect(screen.queryByText(/track new application/i)).not.toBeInTheDocument();
  });

  it('shows the "Add Application" button by default', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    await screen.findByRole('button', { name: /add application/i });
  });

  it('reveals the create form when "Add Application" is clicked', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    const btn = await screen.findByRole('button', { name: /add application/i });
    fireEvent.click(btn);

    expect(await screen.findByText(/track new application/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
  });

  it('hides the create form again when "Cancel" is clicked', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    // Open form
    const addBtn = await screen.findByRole('button', { name: /add application/i });
    fireEvent.click(addBtn);

    // Verify open
    expect(await screen.findByText(/track new application/i)).toBeInTheDocument();

    // Close form
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByText(/track new application/i)).not.toBeInTheDocument();
  });

  // ─── Existing dashboard tests ──────────────────────────────────────────────

  it('shows loading state while fetching', async () => {
    // Never resolves during the test
    vi.mocked(api.listApplications).mockReturnValue(new Promise(() => {}));

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText(/loading applications/i)).toBeInTheDocument();
  });

  it('shows empty state when there are no applications', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText(/no applications yet/i)).toBeInTheDocument();
  });

  it('shows error state when API call fails', async () => {
    vi.mocked(api.listApplications).mockRejectedValue(new Error('Network failure'));

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText(/failed to load applications/i)).toBeInTheDocument();
  });

  it('renders application cards with company and role', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
  });

  it('displays AI status when available', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [
      makeApp({ aiStatus: 'INTERVIEW', userStatus: 'APPLIED' })
    ], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    // AI status takes precedence
    expect(await screen.findByText('Interview')).toBeInTheDocument();
  });

  it('falls back to user status when AI status is null', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [
      makeApp({ aiStatus: null, userStatus: 'RECRUITER_CONTACT' })
    ], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Recruiter')).toBeInTheDocument();
  });

  it('shows pending action indicator when pendingActionCount > 0', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [
      makeApp({ pendingActionCount: 2 })
    ], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('2 actions')).toBeInTheDocument();
  });

  it('does not show action indicator when pendingActionCount is 0', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [
      makeApp({ companyName: 'ZeroActions Inc', pendingActionCount: 0 })
    ], metadata: { limit: 20, offset: 0, nextOffset: null } });
    renderWithProviders(queryClient, '/applications');
    
    await screen.findByText('ZeroActions Inc');
    expect(screen.queryByText(/\d+ action/)).not.toBeInTheDocument();
  });

  it('shows recent event when present', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [
      makeApp({ recentEvent: { type: 'EMAIL_PROCESSED', createdAt: '2026-02-01T10:00:00Z' } })
    ], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText(/email processed/i)).toBeInTheDocument();
  });

  it('renders multiple application cards', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [
      makeApp({ id: 'app-1', companyName: 'Acme' }),
      makeApp({ id: 'app-2', companyName: 'Globex' }),
    ], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Globex')).toBeInTheDocument();
  });
});


// ─── Application Detail / Timeline tests ──────────────────────────────────────

describe('Application Detail Page (/applications/$id)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getApplication).mockResolvedValue(makeApp());
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading state while fetching events and actions', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getApplicationActions).mockReturnValue(new Promise(() => {}));

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByRole('status', { name: /loading application details/i })).toBeInTheDocument();
  });

  it('shows error state when events API fails', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockRejectedValue(new Error('Forbidden'));
    vi.mocked(api.getApplicationActions).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText(/failed to load application data/i)).toBeInTheDocument();
  });

  it('shows empty timeline when no events exist', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationActions).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText(/no events yet/i)).toBeInTheDocument();
  });

  it('renders timeline events in order (first event appears first in DOM)', async () => {
    const events = [
      makeEvent({
        id: 'evt-1',
        description: 'Application detected',
        newState: 'APPLIED',
        createdAt: '2026-01-01T10:00:00Z',
      }),
      makeEvent({
        id: 'evt-2',
        description: 'Recruiter outreach',
        newState: 'RECRUITER_CONTACT',
        createdAt: '2026-01-15T10:00:00Z',
      }),
    ];

    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({ items: events, metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationActions).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications/app-1');

    const descriptions = await screen.findAllByText(/Application detected|Recruiter outreach/);
    expect(descriptions.length).toBe(2);
    // First in DOM = earliest (ASC ordering from backend, preserved by frontend)
    expect(descriptions[0].textContent).toContain('Application detected');
    expect(descriptions[1].textContent).toContain('Recruiter outreach');
  });

  it('displays event type label', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({ items: [
      makeEvent({ type: 'INTERVIEW' })
    ], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationActions).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText('Interview')).toBeInTheDocument();
  });

  it('displays state transition badges', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({ items: [
      makeEvent({ oldState: 'RECRUITER_CONTACT', newState: 'ASSESSMENT' })
    ], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationActions).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText('Recruiter Contact')).toBeInTheDocument();
    expect(screen.getByText('Assessment')).toBeInTheDocument();
  });

  it('displays pending actions with status indicator', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationActions).mockResolvedValue({ items: [makeAction()], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText('Submit portfolio')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('displays provenance when available', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({ items: [
      makeEvent({ provenance: 'gemini-flash' })
    ], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationActions).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText(/source: gemini-flash/i)).toBeInTheDocument();
  });

  it('renders the company name in the header', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationActions).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications/app-1');

    const headers = await screen.findAllByText('Acme Corp');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('shows the back link to applications list', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({ items: [makeApp()], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });
    vi.mocked(api.getApplicationActions).mockResolvedValue({ items: [], metadata: { limit: 20, offset: 0, nextOffset: null } });

    renderWithProviders(queryClient, '/applications/app-1');

    const links = await screen.findAllByText('Applications');
    expect(links.length).toBeGreaterThan(0);
  });
});
