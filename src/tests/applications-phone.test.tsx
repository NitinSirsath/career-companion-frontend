// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApplicationResponse } from '../contracts/application';
import { makeApplication } from './fixtures';

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    listApplications: vi.fn(),
    // vi.fn(impl): a reset keeps this answer.
    getApplicationGroups: vi.fn(async () => ({
      inProgress: 3,
      apply: { total: 5, replied: 1, waiting: 4 },
    })),
    getApplication: vi.fn(),
    getApplicationEvents: vi.fn(),
    getApplicationActions: vi.fn(),
    // The lists' next steps: none unless a test says so.
    getActions: vi.fn(async () => ({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    })),
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

import { afterEach } from 'vitest';

describe('Applications on a phone (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 5)', () => {
  let queryClient: QueryClient;
  let desktopWidth = 0;
  const setWidth = (width: number) =>
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
  beforeEach(() => {
    vi.clearAllMocks();
    desktopWidth = window.innerWidth;
    setWidth(375);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => {
    cleanup();
    setWidth(desktopWidth);
  });

  it('shows plain rows: company, role and place, then status · to do · latest news', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [
        makeApp({
          id: 'a1',
          companyName: 'Brightwave',
          jobTitle: 'Frontend Engineer',
          location: 'Remote',
          aiStatus: 'INTERVIEW',
          effectiveStatus: 'INTERVIEW',
          statusSource: 'AI',
          pendingActionCount: 1,
        }),
        makeApp({
          id: 'a2',
          companyName: 'Northstar Retail',
          aiStatus: 'REJECTED',
          effectiveStatus: 'REJECTED',
          statusSource: 'AI',
          pendingActionCount: 0,
          recentEvent: null,
        }),
      ],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    renderWithProviders(queryClient, '/applications');

    const row = (await screen.findByText('Brightwave')).closest('a');
    expect(row).toHaveAttribute('href', '/applications/a1');
    expect(row).toHaveTextContent('Frontend Engineer · Remote');
    expect(row).toHaveTextContent(/Interview · 1 to do/);
    // No coloured tags in the rows: the status is one small ring.
    expect(row?.querySelector('[data-ring="interview"]')).not.toBeNull();
    // Rejected and closed jobs are faded.
    expect(screen.getByText('Northstar Retail').closest('a')).toHaveClass('opacity-55');
  });

  it('shows the next open step, with a red Past due in place of the count when it is late', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [
        makeApp({ id: 'a1', companyName: 'Brightwave', pendingActionCount: 2 }),
        makeApp({ id: 'a2', companyName: 'BrightPath', pendingActionCount: 1 }),
      ],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    const open = (id: string, applicationId: string, description: string, deadline: string) => ({
      origin: 'EMAIL' as const,
      actionRevision: 0,
      clientRequestId: null,
      snoozedUntil: null,
      id,
      applicationId,
      emailId: null,
      type: 'SCHEDULE_INTERVIEW',
      description,
      deadline,
      deadlinePrecision: 'DATE' as const,
      status: 'PENDING',
      createdAt: '2026-11-01T10:00:00.000Z',
      application: { companyName: 'x', jobTitle: null },
      email: null,
      missed: null,
    });
    vi.mocked(api.getActions).mockResolvedValue({
      items: [
        open('s1', 'a1', 'Pick a time', '2099-01-05T00:00:00Z'),
        open('s2', 'a2', 'Reply with your decision', '2020-01-05T00:00:00Z'),
      ],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    renderWithProviders(queryClient, '/applications');

    const first = (await screen.findByText('Brightwave')).closest('a');
    await waitFor(() => expect(first).toHaveTextContent(/2 to do · Pick a time$/));
    const late = screen.getByText('BrightPath').closest('a');
    expect(late).toHaveTextContent(/Past due · Reply with your decision$/);
    expect(late).not.toHaveTextContent('1 to do');
    expect(within(late as HTMLElement).getByText('Past due')).toHaveClass('text-late');
  });

  it('says "1 missed" in the row when its only open step is missed', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [
        makeApp({
          id: 'a1',
          companyName: 'Brightwave',
          aiStatus: 'INTERVIEW',
          effectiveStatus: 'INTERVIEW',
          statusSource: 'AI',
          pendingActionCount: 0,
          recentEvent: null,
        }),
      ],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    vi.mocked(api.getActions).mockResolvedValue({
      items: [
        {
          origin: 'EMAIL' as const,
          actionRevision: 0,
          clientRequestId: null,
          snoozedUntil: null,
          id: 's1',
          applicationId: 'a1',
          emailId: 'mail-1',
          type: 'SCHEDULE_INTERVIEW',
          description: 'Fill the availability survey',
          deadline: '2020-01-05T00:00:00Z',
          deadlinePrecision: 'DATE' as const,
          status: 'PENDING',
          createdAt: '2026-11-01T10:00:00.000Z',
          application: { companyName: 'x', jobTitle: null },
          email: null,
          missed: { reason: 'DEADLINE_PASSED' as const, since: '2020-01-07T00:00:00.000Z' },
        },
      ],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    renderWithProviders(queryClient, '/applications');

    const row = (await screen.findByText('Brightwave')).closest('a');
    await waitFor(() => expect(row).toHaveTextContent(/Interview · 1 missed$/));
    expect(row).not.toHaveTextContent('Past due');
  });

  it('keeps the filters and refresh in one capsule; the tab bar Search opens the search', async () => {
    vi.mocked(api.listApplications).mockResolvedValue({
      items: [],
      metadata: { limit: 20, offset: 0, nextOffset: null },
    });
    renderWithProviders(queryClient, '/applications');
    const tools = await screen.findByRole('group', { name: 'Application tools' });
    expect(tools).toContainElement(screen.getByRole('button', { name: 'Filter and sort' }));
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(await screen.findByRole('menuitem', { name: 'Refresh' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: 'Search' })).not.toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(
      await screen.findByRole('searchbox', { name: 'Search company or job title' }),
    ).toBeInTheDocument();
  });
});
