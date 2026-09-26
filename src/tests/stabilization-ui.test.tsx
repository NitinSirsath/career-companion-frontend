// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { routeTree } from '../routeTree.gen';
import type { ApplicationResponse, PaginatedResponse } from '../contracts';
vi.mock('../api/client', () => ({ api: {
  listApplications: vi.fn(), getApplication: vi.fn(), getApplicationActions: vi.fn(), getApplicationEvents: vi.fn(),
  getActions: vi.fn(), updateAction: vi.fn(), getAmbiguousEmails: vi.fn(), getUnmatchedEmails: vi.fn(), resolveUnmatchedEmail: vi.fn(),
} }));
const page = <T,>(items: T[], offset = 0, nextOffset: number | null = null): PaginatedResponse<T> => ({ items, metadata: { limit: 20, offset, nextOffset } });
const application: ApplicationResponse = { id: 'older-app', companyName: 'Older Company', jobTitle: 'Engineer', location: null, aiStatus: null, userStatus: null, userStatusSetAt: null, appliedAt: null, createdAt: '2026-09-01', updatedAt: '2026-09-01', recentEvent: null, pendingActionCount: 0 };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listApplications).mockResolvedValue(page([]));
  vi.mocked(api.getApplication).mockResolvedValue(application);
  vi.mocked(api.getApplicationEvents).mockResolvedValue(page([]));
  vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
  vi.mocked(api.getActions).mockResolvedValue(page([]));
  vi.mocked(api.getUnmatchedEmails).mockResolvedValue(page([]));
  vi.mocked(api.getAmbiguousEmails).mockResolvedValue(page([]));
});
afterEach(cleanup);
function show(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }), context: { user: { id: 'user', email: 'test@test.local', name: 'Test' } } });
  render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>);
}
it('loads an application detail by ID even when it is absent from the first list page', async () => {
  show('/applications/older-app');
  expect(await screen.findByRole('heading', { name: 'Older Company' })).toBeInTheDocument();
  expect(api.getApplication).toHaveBeenCalledWith('older-app');
  expect(api.listApplications).not.toHaveBeenCalled();
});
it('keeps Previous available when a later action page becomes empty', async () => {
  const action = { id: 'action-1', applicationId: 'older-app', emailId: null, type: 'ACTION_REQUIRED', description: 'Reply to recruiter', deadline: null, status: 'PENDING', createdAt: '2026-09-01', application: { companyName: 'Older Company', jobTitle: null }, email: null };
  vi.mocked(api.getActions).mockImplementation(async (_status, params) => params?.offset ? page([], 20) : page([action], 0, 20));
  show('/');
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
  expect(await screen.findByText('No actions on this page.')).toBeInTheDocument();
  const previous = screen.getByRole('button', { name: 'Previous' });
  expect(previous).toBeEnabled(); fireEvent.click(previous);
  expect(await screen.findByText('Reply to recruiter')).toBeInTheDocument();
});
it('can select an application beyond the first 20 when linking an email', async () => {
  vi.mocked(api.listApplications).mockImplementation(async params => params?.offset ? page([application], 20) : page([{ ...application, id: 'recent', companyName: 'Recent Company' }], 0, 20));
  vi.mocked(api.getUnmatchedEmails).mockResolvedValue(page([{ id: 'email', subject: 'Interview', sender: 'hr@example.test', receivedAt: null, aiProcessingResult: null }]));
  vi.mocked(api.resolveUnmatchedEmail).mockResolvedValue({ success: true });
  show('/');
  const selector = await screen.findByRole('region', { name: 'Applications for matching' });
  fireEvent.click(within(selector).getByRole('button', { name: 'Next' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Older Company' }));
  await waitFor(() => expect(api.resolveUnmatchedEmail).toHaveBeenCalledWith('email', { applicationId: 'older-app' }));
});
it('shows a failed action mutation and permits retry', async () => {
  const action = { id: 'action-1', applicationId: 'older-app', emailId: null, type: 'ACTION_REQUIRED', description: 'Reply', deadline: null, status: 'PENDING', createdAt: '2026-09-01', application: { companyName: 'Older Company', jobTitle: null }, email: null };
  vi.mocked(api.getActions).mockResolvedValue(page([action]));
  vi.mocked(api.updateAction).mockRejectedValue(new Error('Network unavailable'));
  show('/');
  fireEvent.click(await screen.findByRole('button', { name: 'Complete' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
  expect(screen.getByRole('button', { name: 'Complete' })).toBeEnabled();
});
