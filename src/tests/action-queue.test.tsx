// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { routeTree } from '../routeTree.gen';
import { ActionWithContextResponse } from '../contracts/action';

const MOCK_USER = { id: 'test-user', email: 'test@test.local', name: 'Test User' };

function createTestRouter(initialPath = '/applications') {
  const history = createMemoryHistory({ initialEntries: [initialPath] });
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

// Mocks
vi.mock('../api/client', () => ({
  api: {
    listApplications: vi.fn(),
    createApplication: vi.fn(),
    getAmbiguousEmails: vi.fn(),
    getActions: vi.fn(),
    updateAction: vi.fn(),
  }
}));

const makeAction = (overrides?: Partial<ActionWithContextResponse>): ActionWithContextResponse => ({
  id: 'action-1',
  applicationId: 'app-1',
  emailId: null,
  type: 'ACTION_REQUIRED',
  description: 'Submit assignment',
  deadline: null,
  status: 'PENDING',
  createdAt: '2026-01-15T10:00:00.000Z',
  application: {
    companyName: 'Acme Corp',
    jobTitle: 'Senior Engineer',
  },
  email: null,
  ...overrides,
});

describe('Action Queue (COM-33)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.mocked(api.listApplications).mockResolvedValue([]);
    vi.mocked(api.getAmbiguousEmails).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('does not render queue if no pending actions', async () => {
    vi.mocked(api.getActions).mockResolvedValue([]);
    renderWithProviders(queryClient, '/');

    await waitFor(() => {
      expect(screen.queryByText('Loading action queue...')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Action Center')).not.toBeInTheDocument();
  });

  it('renders pending actions grouped correctly', async () => {
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 1);

    const upcomingDate = new Date();
    upcomingDate.setDate(upcomingDate.getDate() + 1);

    vi.mocked(api.getActions).mockResolvedValue([
      makeAction({ id: 'a1', description: 'Overdue task', deadline: overdueDate.toISOString() }),
      makeAction({ id: 'a2', description: 'Upcoming task', deadline: upcomingDate.toISOString() }),
      makeAction({ id: 'a3', description: 'Pending task', deadline: null })
    ]);

    renderWithProviders(queryClient, '/');

    expect(await screen.findByText('Action Center')).toBeInTheDocument();
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
    expect(screen.getByText('Overdue task')).toBeInTheDocument();
    
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Upcoming task')).toBeInTheDocument();

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Pending task')).toBeInTheDocument();

    // Verify context is shown
    const companyNames = screen.getAllByText(/Acme Corp/);
    expect(companyNames.length).toBeGreaterThan(0);
  });

  it('submits Complete correctly', async () => {
    vi.mocked(api.getActions).mockResolvedValue([makeAction({ id: 'a1' })]);
    vi.mocked(api.updateAction).mockResolvedValue(makeAction({ id: 'a1', status: 'COMPLETED' }));

    renderWithProviders(queryClient, '/');

    const completeBtn = await screen.findByRole('button', { name: /^Complete$/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(api.updateAction).toHaveBeenCalledWith('a1', { status: 'COMPLETED' });
    });
  });

  it('submits Dismiss correctly', async () => {
    vi.mocked(api.getActions).mockResolvedValue([makeAction({ id: 'a1' })]);
    vi.mocked(api.updateAction).mockResolvedValue(makeAction({ id: 'a1', status: 'DISMISSED' }));

    renderWithProviders(queryClient, '/');

    const dismissBtn = await screen.findByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(api.updateAction).toHaveBeenCalledWith('a1', { status: 'DISMISSED' });
    });
  });
});
