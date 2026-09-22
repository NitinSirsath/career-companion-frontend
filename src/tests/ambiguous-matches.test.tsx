// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { routeTree } from '../routeTree.gen';
import { ApplicationResponse } from '../contracts/application';

const MOCK_USER = { id: 'test-user', email: 'test@test.local', name: 'Test User' };

function createTestRouter(initialPath = '/applications') {
  const history = createMemoryHistory({
    initialEntries: [initialPath],
  });
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
    resolveAmbiguousEmail: vi.fn(),
  }
}));

const makeApp = (overrides?: Partial<ApplicationResponse>): ApplicationResponse => ({
  id: 'app-1',
  companyName: 'Acme Corp',
  jobTitle: 'Senior Engineer',
  location: 'Remote',
  aiStatus: 'APPLIED',
  userStatus: null,
  userStatusSetAt: null,
  appliedAt: '2026-01-15T10:00:00.000Z',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  recentEvent: null,
  pendingActionCount: 0,
  ...overrides,
});

describe('Ambiguous Matches (COM-32)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders ambiguous matches when present', async () => {
    vi.mocked(api.listApplications).mockResolvedValue([makeApp()]);
    vi.mocked(api.getAmbiguousEmails).mockResolvedValue([
      {
        id: 'email-1',
        sender: 'recruiter@tech.com',
        subject: 'Next steps',
        receivedAt: '2026-01-16T10:00:00Z',
        aiProcessingResult: {
          companyName: 'Tech Co',
          jobTitle: null,
          confidence: 0.5,
          category: 'INTERVIEW',
        }
      }
    ]);

    renderWithProviders(queryClient, '/');

    expect(await screen.findByText('Needs Review (1)')).toBeInTheDocument();
    expect(screen.getByText('recruiter@tech.com')).toBeInTheDocument();
    expect(screen.getByText('Next steps')).toBeInTheDocument();
    
    // Candidate applications render
    expect(screen.getByRole('button', { name: /Acme Corp/ })).toBeInTheDocument();
    // Ignore button renders
    expect(screen.getByRole('button', { name: /Not related/i })).toBeInTheDocument();
  });

  it('submits resolution request successfully to an application', async () => {
    vi.mocked(api.listApplications).mockResolvedValue([makeApp()]);
    vi.mocked(api.getAmbiguousEmails).mockResolvedValue([
      {
        id: 'email-1',
        sender: 'recruiter@tech.com',
        subject: 'Next steps',
        receivedAt: '2026-01-16T10:00:00Z',
        aiProcessingResult: null
      }
    ]);
    vi.mocked(api.resolveAmbiguousEmail).mockResolvedValue({ success: true });

    renderWithProviders(queryClient, '/');

    const selectButton = await screen.findByRole('button', { name: /Acme Corp/ });
    fireEvent.click(selectButton);

    await waitFor(() => {
      expect(api.resolveAmbiguousEmail).toHaveBeenCalledWith('email-1', { applicationId: 'app-1' });
    });
  });

  it('submits resolution request successfully as not related (null)', async () => {
    vi.mocked(api.listApplications).mockResolvedValue([makeApp()]);
    vi.mocked(api.getAmbiguousEmails).mockResolvedValue([
      {
        id: 'email-1',
        sender: 'recruiter@tech.com',
        subject: 'Next steps',
        receivedAt: '2026-01-16T10:00:00Z',
        aiProcessingResult: null
      }
    ]);
    vi.mocked(api.resolveAmbiguousEmail).mockResolvedValue({ success: true });

    renderWithProviders(queryClient, '/');

    const ignoreButton = await screen.findByRole('button', { name: /Not related/i });
    fireEvent.click(ignoreButton);

    await waitFor(() => {
      expect(api.resolveAmbiguousEmail).toHaveBeenCalledWith('email-1', { applicationId: null });
    });
  });
});
