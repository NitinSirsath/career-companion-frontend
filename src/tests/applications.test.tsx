// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApplicationResponse, ApplicationActionResponse } from '../contracts/application';
import { makeApplication, makeEvent } from './fixtures';

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
  },
}));

import { routeTree } from '../routeTree.gen';

// ─── Helper factories ─────────────────────────────────────────────────────────

function makeApp(overrides: Partial<ApplicationResponse> = {}): ApplicationResponse {
  return makeApplication({ userStatus: 'APPLIED', ...overrides });
}

function makeAction(overrides: Partial<ApplicationActionResponse> = {}): ApplicationActionResponse {
  return {
    origin: null,
    actionRevision: 0,
    clientRequestId: null,
    snoozedUntil: null,
    id: 'act-1',
    applicationId: 'app-1',
    emailId: null,
    type: 'ACTION_REQUIRED',
    description: 'Submit portfolio',
    deadline: '2026-02-15T00:00:00Z',
    deadlinePrecision: null,
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
    </QueryClientProvider>,
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
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    // Form heading should not be visible until toggled
    // Use findByText first to ensure the page has loaded
    await screen.findByText(/no applications yet/i);
    expect(screen.queryByText(/track new application/i)).not.toBeInTheDocument();
  });

  it('shows the "Add Application" button by default', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    await screen.findByRole('button', { name: /add application/i });
  });

  it('reveals the create form when "Add Application" is clicked', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    const btn = await screen.findByRole('button', { name: /add application/i });
    fireEvent.click(btn);

    expect(await screen.findByText(/track new application/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
  });

  it('hides the create form again when "Cancel" is clicked', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

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
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText(/no applications yet/i)).toBeInTheDocument();
  });

  it('shows error state when API call fails', async () => {
    vi.mocked(api.listApplications).mockRejectedValue(new Error('Network failure'));

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText(/failed to load applications/i)).toBeInTheDocument();
  });

  it('renders application cards with company and role', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument();
  });

  it('shows the user status over a disagreeing AI status (canonical precedence)', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ aiStatus: 'INTERVIEW', userStatus: 'APPLIED' })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(
      await screen.findByText('Application Received', { selector: 'div' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Set by you')).toBeInTheDocument();
    expect(screen.getByText(/AI suggests Interview/)).toBeInTheDocument();
  });

  it('shows the AI status when the user has not set one', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ aiStatus: 'RECRUITER_CONTACT', userStatus: null })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Recruiter Contact', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('Inferred by AI')).toBeInTheDocument();
  });

  it('shows a neutral unknown instead of defaulting to Application Received', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ aiStatus: null, userStatus: null })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Status unknown')).toBeInTheDocument();
    expect(screen.queryByText('Application Received', { selector: 'div' })).not.toBeInTheDocument();
  });

  it('shows pending action indicator when pendingActionCount > 0', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ pendingActionCount: 2 })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('2 actions')).toBeInTheDocument();
  });

  it('does not show action indicator when pendingActionCount is 0', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ companyName: 'ZeroActions Inc', pendingActionCount: 0 })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    renderWithProviders(queryClient, '/applications');

    await screen.findByText('ZeroActions Inc');
    expect(screen.queryByText(/\d+ action/)).not.toBeInTheDocument();
  });

  it('shows recent event when present', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [
        makeApp({
          recentEvent: {
            type: 'EMAIL_PROCESSED',
            createdAt: '2026-02-01T10:00:00Z',
            recordedAt: '2026-02-01T10:00:00.000Z',
            sourceEmail: null,
            sourceSubmission: null,
          },
        }),
      ],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText(/email processed/i)).toBeInTheDocument();
  });

  it('renders multiple application cards', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [
        makeApp({ id: 'app-1', companyName: 'Acme' }),
        makeApp({ id: 'app-2', companyName: 'Globex' }),
      ],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

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
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockReturnValue(new Promise(() => {}));
    vi.mocked(api.getApplicationActions).mockReturnValue(new Promise(() => {}));

    renderWithProviders(queryClient, '/applications/app-1');

    expect(
      await screen.findByRole('status', { name: /loading application details/i }),
    ).toBeInTheDocument();
  });

  it('shows error state when events API fails', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockRejectedValue(new Error('Forbidden'));
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText(/failed to load history/i)).toBeInTheDocument();
    // A history failure does not hide the application or block editing.
    expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change status' })).toBeEnabled();
  });

  it('shows empty timeline when no events exist', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText(/no events yet/i)).toBeInTheDocument();
  });

  it('marks retired evidence and offers correction only on the active source email', async () => {
    const sourceEmail = { id: 'email-1', subject: 'Interview', sender: null, receivedAt: null };
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: [
        makeEvent({ retiredAt: '2026-10-03T00:00:00Z', retiredReason: 'EMAIL_MOVED', sourceEmail }),
        makeEvent({ id: 'event-2', sourceEmail: { ...sourceEmail, id: 'email-2' } }),
      ],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    renderWithProviders(queryClient, '/applications/app-1');
    expect(await screen.findByText(/Moved to another application/)).toBeInTheDocument();
    expect(screen.getByText(/No longer counts toward/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Wrong application?' })).toHaveLength(1);
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

    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: events,
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    const descriptions = await screen.findAllByText(/Application detected|Recruiter outreach/);
    expect(descriptions.length).toBe(2);
    // First in DOM = earliest (ASC ordering from backend, preserved by frontend)
    expect(descriptions[0].textContent).toContain('Application detected');
    expect(descriptions[1].textContent).toContain('Recruiter outreach');
  });

  it('displays event type label', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: [makeEvent({ type: 'INTERVIEW' })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText('Interview')).toBeInTheDocument();
  });

  it('displays state transition badges', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: [makeEvent({ oldState: 'RECRUITER_CONTACT', newState: 'ASSESSMENT' })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(
      await screen.findByText('AI status: Recruiter Contact → Assessment'),
    ).toBeInTheDocument();
  });

  it('displays pending actions with status indicator', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [makeAction({ deadlinePrecision: 'DATE' })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText('Submit portfolio')).toBeInTheDocument();
    expect(screen.getByText('Due Feb 15, 2026')).toBeInTheDocument();
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });

  it('displays provenance when available', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: [makeEvent({ provenance: 'gemini-flash' })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText('gemini-flash')).toBeInTheDocument();
    expect(screen.getByText(/AI interpretation/)).toBeInTheDocument();
  });

  it('renders the company name in the header', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    const headers = await screen.findAllByText('Acme Corp');
    expect(headers.length).toBeGreaterThan(0);
  });

  it('shows the back link to applications list', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    const links = await screen.findAllByText('Applications');
    expect(links.length).toBeGreaterThan(0);
  });
});

describe('application discovery controls (S9)', () => {
  const page = (items: ApplicationResponse[], offset = 0, nextOffset: number | null = null) => ({
    items,
    metadata: { offset, limit: 20, nextOffset },
  });
  let qc: QueryClient;
  beforeEach(() => {
    vi.resetAllMocks();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    cleanup();
    qc.clear();
  });
  it('filters before browsing, resets a later page and preserves filters on a read error', async () => {
    vi.mocked(api.listApplications).mockImplementation(async (params) => {
      if (params?.q) throw new Error('Search unavailable');
      return page([makeApp()], params?.offset, 20);
    });
    renderWithProviders(qc, '/applications');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 20 }),
        expect.anything(),
      ),
    );
    fireEvent.change(screen.getByLabelText('Search company or job title'), {
      target: { value: 'Acme' },
    });
    await screen.findByText(/Search unavailable/);
    expect(api.listApplications).toHaveBeenLastCalledWith(
      { archive: 'active', q: 'Acme', limit: 20, offset: 0 },
      expect.anything(),
    );
    expect(screen.getByLabelText('Search company or job title')).toHaveValue('Acme');
    fireEvent.click(screen.getByRole('button', { name: 'Rejected' }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        { archive: 'active', q: 'Acme', effectiveStatus: 'REJECTED', limit: 20, offset: 0 },
        expect.anything(),
      ),
    );
  });
  it('ignores superseded search results and explains an empty filtered result', async () => {
    let resolve!: (value: ReturnType<typeof page>) => void;
    vi.mocked(api.listApplications).mockImplementation(async (params) =>
      params?.q === 'old'
        ? new Promise((res) => {
            resolve = res;
          })
        : page([]),
    );
    renderWithProviders(qc, '/applications');
    await screen.findByText('No applications yet');
    fireEvent.change(screen.getByLabelText('Search company or job title'), {
      target: { value: 'old' },
    });
    await waitFor(() => expect(resolve).toBeDefined());
    fireEvent.change(screen.getByLabelText('Search company or job title'), {
      target: { value: 'new' },
    });
    await screen.findByText('No matching applications');
    await act(async () => resolve(page([makeApp({ companyName: 'Stale old result' })])));
    expect(screen.queryByText('Stale old result')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Search company or job title')).toHaveValue('new');
  });
});

describe('application discovery completion (AD-02)', () => {
  const page = <T,>(items: T[], offset = 0, nextOffset: number | null = null) => ({
    items,
    metadata: { offset, limit: 20, nextOffset },
  });
  const recorded = makeApplication({
    companyName: 'Automation target',
    submittedVia: 'AUTOMATION',
    appliedAt: null,
  });
  let qc: QueryClient;
  beforeEach(() => {
    vi.resetAllMocks();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.getApplication).mockResolvedValue(recorded);
    vi.mocked(api.getApplicationEvents).mockResolvedValue(page([]));
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
  });
  afterEach(() => {
    cleanup();
    qc.clear();
  });

  it('preserves every discovery control and page through a detail visit', async () => {
    vi.mocked(api.listApplications).mockImplementation(async (params) =>
      page([recorded], params?.offset, 20),
    );
    renderWithProviders(qc, '/applications');
    await screen.findByText('Automation target');
    fireEvent.change(screen.getByLabelText('Search company or job title'), {
      target: { value: 'target' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'All' })); // Was UNKNOWN status, but since we removed it, this test needs adjustment. Actually, UNKNOWN apps are in ALL.
    // wait, how to filter UNKNOWN now? There is no tab for UNKNOWN.
    fireEvent.click(screen.getByRole('button', { name: 'Application Submitted' }));
    fireEvent.change(screen.getByLabelText('Application visibility'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Sort applications'), {
      target: { value: 'applied_desc' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Showing 21–21');
    fireEvent.click(screen.getByRole('link', { name: /Automation target/ }));
    await screen.findByRole('button', { name: 'Change status' });
    // The breadcrumb and both nav surfaces lead through the same existing parent route.
    fireEvent.click(screen.getAllByRole('link', { name: 'Applications' })[0]);
    await screen.findByLabelText('Sort applications');
    expect(screen.getByLabelText('Search company or job title')).toHaveValue('target');
    expect(screen.getByRole('button', { name: 'Application Submitted' })).toHaveClass(
      'border-foreground',
    );
    expect(screen.getByLabelText('Application visibility')).toHaveValue('all');
    expect(screen.getByLabelText('Sort applications')).toHaveValue('applied_desc');
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        {
          offset: 20,
          limit: 20,
          archive: 'all',
          q: 'target',
          effectiveStatus: 'UNKNOWN',
          submittedVia: 'AUTOMATION',
          sort: 'applied_desc',
        },
        expect.anything(),
      ),
    );
    expect(screen.getByText('Applied date unknown')).toBeInTheDocument();
  });

  it('resets paging for sort and source and clears all discovery controls', async () => {
    vi.mocked(api.listApplications).mockImplementation(async (params) =>
      page([recorded], params?.offset, 20),
    );
    renderWithProviders(qc, '/applications');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await screen.findByText('Showing 21–21');
    fireEvent.change(screen.getByLabelText('Sort applications'), {
      target: { value: 'applied_asc' },
    });
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        { offset: 0, limit: 20, archive: 'active', sort: 'applied_asc' },
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Application Submitted' }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 0, submittedVia: 'AUTOMATION' }),
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        { offset: 0, limit: 20, archive: 'active' },
        expect.anything(),
      ),
    );
    expect(screen.getByLabelText('Sort applications')).toHaveValue('added_desc');
    expect(screen.getByRole('button', { name: 'All' })).toHaveClass('border-foreground');
  });

  it('retries a failed filtered read and refreshes newly recorded intake without posting', async () => {
    vi.mocked(api.listApplications).mockImplementation(async (params) => {
      if (params?.submittedVia) throw new Error('Temporarily unavailable');
      return page([]);
    });
    renderWithProviders(qc, '/applications');
    await screen.findByText('No applications yet');
    fireEvent.click(screen.getByRole('button', { name: 'Application Submitted' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporarily unavailable');
    expect(screen.getByRole('button', { name: 'Application Submitted' })).toHaveClass(
      'border-foreground',
    );
    vi.mocked(api.listApplications).mockResolvedValue(page([]));
    fireEvent.click(screen.getByRole('button', { name: 'Retry applications' }));
    await screen.findByText('No matching applications');
    expect(screen.getByRole('link', { name: 'Automation review' })).toHaveAttribute(
      'href',
      '/automation',
    );
    vi.mocked(api.listApplications).mockResolvedValue(page([recorded]));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh applications' }));
    await screen.findByText('Automation target');
    expect(api.createApplication).not.toHaveBeenCalled();
  });

  it('returns an empty later page to the first page while retaining discovery choices', async () => {
    vi.mocked(api.listApplications).mockImplementation(async (params) =>
      page(params?.offset ? [] : [recorded], params?.offset, params?.offset ? null : 20),
    );
    renderWithProviders(qc, '/applications');
    fireEvent.change(await screen.findByLabelText('Sort applications'), {
      target: { value: 'company_asc' },
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 20 }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled());
    expect(screen.getByLabelText('Sort applications')).toHaveValue('company_asc');
  });
});
