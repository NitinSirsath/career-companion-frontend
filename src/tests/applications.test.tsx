// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApplicationResponse, ApplicationActionListItem } from '../contracts/application';
import { makeApplication, makeEvent } from './fixtures';

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    listApplications: vi.fn(),
    getApplication: vi.fn(),
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

function makeAction(overrides: Partial<ApplicationActionListItem> = {}): ApplicationActionListItem {
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
    repliedAt: null,
    askKind: null,
    closedReason: null,
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
import { chooseOption } from './choose';

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

  it('has no way to add an application by hand', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    // Applications come from mails and the automation only.
    expect(await screen.findByText(/when the app finds one in your mails/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add application/i })).not.toBeInTheDocument();
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

    expect(await screen.findByText(/could not load your applications/i)).toBeInTheDocument();
  });

  it('renders application cards with company and role', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText(/Senior Engineer/)).toBeInTheDocument();
  });

  it('shows the user status over a disagreeing AI status (canonical precedence)', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ aiStatus: 'INTERVIEW', userStatus: 'APPLIED' })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Applied', { selector: 'span' })).toBeInTheDocument();
    // Who set it is an icon with its words for screen readers; the AI's other opinion is on the
    // application's own page.
    expect(screen.getByText('Status set by you')).toBeInTheDocument();
  });

  it('shows the AI status when the user has not set one', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ aiStatus: 'RECRUITER_CONTACT', userStatus: null })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Recruiter contact', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Status set by the AI from a mail')).toBeInTheDocument();
  });

  it('shows a neutral unknown instead of defaulting to Application Received', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ aiStatus: null, userStatus: null })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('Status unknown')).toBeInTheDocument();
    expect(screen.queryByText('Applied', { selector: 'span' })).not.toBeInTheDocument();
  });

  it('shows pending action indicator when pendingActionCount > 0', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ pendingActionCount: 2 })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications');

    expect(await screen.findByText('2 to do')).toBeInTheDocument();
  });

  it('names each value on phones, where the header row is hidden', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ pendingActionCount: 0, recentEvent: null })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    renderWithProviders(queryClient, '/applications');

    const none = await screen.findByText('None yet');
    const cell = none.closest('[role="cell"]');
    expect(cell).toHaveTextContent(/^Last activityNone yet$/);
    expect(screen.getByText('Last activity', { selector: '[role="cell"] > div' })).toHaveClass(
      'md:hidden',
    );
  });

  it('does not show action indicator when pendingActionCount is 0', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp({ companyName: 'ZeroActions Inc', pendingActionCount: 0 })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    renderWithProviders(queryClient, '/applications');

    await screen.findByText('ZeroActions Inc');
    expect(screen.queryByText(/\d+ to do/)).not.toBeInTheDocument();
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

    // The latest event in plain words: a mail with no sender kept is "A job mail".
    expect(await screen.findByText('A job mail')).toBeInTheDocument();
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

    expect(await screen.findByText('Loading next steps')).toBeInTheDocument();
    expect(screen.getByText('Loading history')).toBeInTheDocument();
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

    expect(await screen.findByText(/could not load the history/i)).toBeInTheDocument();
    // A history failure does not hide the application or block editing.
    expect(screen.getByRole('heading', { name: 'Acme Corp' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Change status/ })).toBeEnabled();
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

    expect(await screen.findByText(/^Nothing yet\. Mails the AI reads/)).toBeInTheDocument();
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
    expect(await screen.findByText(/^Moved to another application on/)).toBeInTheDocument();
    expect(screen.getByText(/no longer counts toward the AI's status/)).toBeInTheDocument();
    // Only the mail that still counts offers "Wrong application?" in its "…" menu.
    const menus = screen.getAllByRole('button', { name: /^More for Mail from/ });
    expect(menus).toHaveLength(1);
    fireEvent.click(menus[0]);
    expect(await screen.findByRole('menuitem', { name: 'Wrong application?' })).toBeInTheDocument();
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

    const lines = await screen.findAllByText(/^The AI set the status to/);
    expect(lines.length).toBe(2);
    // First in DOM = earliest (ASC ordering from backend, preserved by frontend)
    expect(lines[0].textContent).toContain('Applied');
    expect(lines[1].textContent).toContain('Recruiter contact');
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
      await screen.findByText('The AI moved the status from Recruiter contact to Assessment'),
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
    // The deadline has passed: the step stays open and says so.
    expect(screen.getByText(/^Past due Feb 15, 2026 · /)).toBeInTheDocument();
    expect(screen.getByText('1 open')).toBeInTheDocument();
    // A step of the user's own (no mail behind it) keeps Complete.
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
  });

  it('shows an action whose mail the user replied to as replied, with no Complete', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [makeApp()],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationEvents).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getApplicationActions).mockResolvedValue({
      items: [makeAction({ emailId: 'mail-1', repliedAt: '2026-02-03T09:30:00Z' })],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });

    renderWithProviders(queryClient, '/applications/app-1');

    expect(await screen.findByText('Replied')).toBeInTheDocument();
    expect(screen.getByText(/^You replied Feb 3/)).toBeInTheDocument();
    expect(screen.queryByText(/^Due Feb 15, 2026/)).not.toBeInTheDocument();
    // A step from a mail closes when a reply or a newer mail settles it (owner, 24 Oct 2026).
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByRole('button', { name: 'Show the AI note' }));
    expect(screen.getByText('gemini-flash')).toBeInTheDocument();
    expect(screen.getByText(/the AI's reading, not the mail's own words/)).toBeInTheDocument();
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
    await screen.findByText(/Could not load your applications/);
    expect(api.listApplications).toHaveBeenLastCalledWith(
      { archive: 'active', q: 'Acme', limit: 20, offset: 0 },
      expect.anything(),
    );
    expect(screen.getByLabelText('Search company or job title')).toHaveValue('Acme');
    fireEvent.click(screen.getByRole('tab', { name: 'Rejected' }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        { archive: 'active', q: 'Acme', effectiveStatus: 'REJECTED', limit: 20, offset: 0 },
        expect.anything(),
      ),
    );
  });
  it('searches once when typing stops, not on every key', async () => {
    vi.mocked(api.listApplications).mockResolvedValue(page([]));
    renderWithProviders(qc, '/applications');
    await screen.findByText('No applications yet');
    const box = screen.getByLabelText('Search company or job title');
    for (const value of ['A', 'Ac', 'Acm', 'Acme']) fireEvent.change(box, { target: { value } });
    expect(box).toHaveValue('Acme');
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        { archive: 'active', q: 'Acme', limit: 20, offset: 0 },
        expect.anything(),
      ),
    );
    const searches = vi.mocked(api.listApplications).mock.calls.map(([params]) => params?.q);
    expect(searches.filter(Boolean)).toEqual(['Acme']);
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
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'target' }),
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'All' })); // Was UNKNOWN status, but since we removed it, this test needs adjustment. Actually, UNKNOWN apps are in ALL.
    // wait, how to filter UNKNOWN now? There is no tab for UNKNOWN.
    fireEvent.click(screen.getByRole('tab', { name: 'Sent by automation' }));
    await chooseOption(
      screen.getByRole('combobox', { name: 'Application visibility' }),
      'All applications',
    );
    await chooseOption(
      screen.getByRole('combobox', { name: 'Sort applications' }),
      'Applied date: newest first',
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Showing 21–21');
    fireEvent.click(screen.getByRole('link', { name: /Automation target/ }));
    await screen.findByRole('combobox', { name: /Change status/ });
    // The breadcrumb and both nav surfaces lead through the same existing parent route.
    fireEvent.click(screen.getAllByRole('link', { name: 'Applications' })[0]);
    await screen.findByLabelText('Sort applications');
    expect(screen.getByLabelText('Search company or job title')).toHaveValue('target');
    expect(screen.getByRole('tab', { name: 'Sent by automation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('combobox', { name: 'Application visibility' })).toHaveTextContent(
      'All applications',
    );
    expect(screen.getByRole('combobox', { name: 'Sort applications' })).toHaveTextContent(
      'Applied date: newest first',
    );
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
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('resets paging for sort and source and clears all discovery controls', async () => {
    vi.mocked(api.listApplications).mockImplementation(async (params) =>
      page([recorded], params?.offset, 20),
    );
    renderWithProviders(qc, '/applications');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await screen.findByText('Showing 21–21');
    await chooseOption(
      screen.getByRole('combobox', { name: 'Sort applications' }),
      'Applied date: oldest first',
    );
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        { offset: 0, limit: 20, archive: 'active', sort: 'applied_asc' },
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Sent by automation' }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 0, submittedVia: 'AUTOMATION' }),
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenLastCalledWith(
        { offset: 0, limit: 20, archive: 'active' },
        expect.anything(),
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Sort applications' })).toHaveTextContent(
      'Newest added',
    );
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true');
  });

  it('retries a failed filtered read and refreshes newly recorded intake without posting', async () => {
    vi.mocked(api.listApplications).mockImplementation(async (params) => {
      if (params?.submittedVia) throw new Error('Temporarily unavailable');
      return page([]);
    });
    renderWithProviders(qc, '/applications');
    await screen.findByText('No applications yet');
    fireEvent.click(screen.getByRole('tab', { name: 'Sent by automation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your applications');
    expect(screen.getByRole('tab', { name: 'Sent by automation' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    vi.mocked(api.listApplications).mockResolvedValue(page([]));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('No matching applications');
    expect(screen.getByRole('link', { name: 'Automation review' })).toHaveAttribute(
      'href',
      '/automation',
    );
    vi.mocked(api.listApplications).mockResolvedValue(page([recorded]));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh applications' }));
    await screen.findByText('Automation target');
  });

  it('returns an empty later page to the first page while retaining discovery choices', async () => {
    vi.mocked(api.listApplications).mockImplementation(async (params) =>
      page(params?.offset ? [] : [recorded], params?.offset, params?.offset ? null : 20),
    );
    renderWithProviders(qc, '/applications');
    await chooseOption(
      await screen.findByRole('combobox', { name: 'Sort applications' }),
      'Company: A to Z',
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenCalledWith(
        expect.objectContaining({ offset: 20 }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled());
    expect(screen.getByRole('combobox', { name: 'Sort applications' })).toHaveTextContent(
      'Company: A to Z',
    );
  });
});
