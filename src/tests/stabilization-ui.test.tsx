// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { routeTree } from '../routeTree.gen';
import type { ApplicationResponse, PaginatedResponse } from '../contracts';
import { workspacePage, makeApplication } from './fixtures';
vi.mock('../api/client', async (importOriginal) => ({ ...await importOriginal<typeof import('../api/client')>(), api: {
  listApplications: vi.fn(), getApplication: vi.fn(), getApplicationActions: vi.fn(), getApplicationEvents: vi.fn(),
  getActions: vi.fn(), getWorkspaceActions: vi.fn(), getWorkspaceReview: vi.fn(), getGmailStatus: vi.fn(), getAISettings: vi.fn(), updateAction: vi.fn(), getAmbiguousEmails: vi.fn(), getUnmatchedEmails: vi.fn(), getPendingSubmissions: vi.fn(), resolveUnmatchedEmail: vi.fn(),
} }));
const page = <T,>(items: T[], offset = 0, nextOffset: number | null = null): PaginatedResponse<T> => ({ items, metadata: { limit: 20, offset, nextOffset } });
const application: ApplicationResponse = makeApplication({ id: 'older-app', companyName: 'Older Company', jobTitle: 'Engineer', location: null, appliedAt: null, createdAt: '2026-09-01', updatedAt: '2026-09-01' });
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getWorkspaceActions).mockResolvedValue(workspacePage());
  vi.mocked(api.getWorkspaceReview).mockResolvedValue({ generatedAt: new Date().toISOString(), unmatched: 0, ambiguous: 0, pendingSubmissions: 0 });
  vi.mocked(api.getGmailStatus).mockResolvedValue({ connected: false, gmailEmail: null, status: null, syncStatus: null, lastSyncedAt: null });
  vi.mocked(api.getAISettings).mockRejectedValue(new Error('fixture unavailable'));
  vi.mocked(api.listApplications).mockResolvedValue(page([]));
  vi.mocked(api.getApplication).mockResolvedValue(application);
  vi.mocked(api.getApplicationEvents).mockResolvedValue(page([]));
  vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
  vi.mocked(api.getActions).mockResolvedValue(page([]));
  vi.mocked(api.getUnmatchedEmails).mockResolvedValue(page([]));
  vi.mocked(api.getPendingSubmissions).mockResolvedValue(page([]));
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
  expect(api.getApplication).toHaveBeenCalledWith('older-app', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(api.listApplications).not.toHaveBeenCalled();
});
it('recovers to page one when a later action page becomes empty', async () => {
  const action = { id: 'action-1', applicationId: 'older-app', emailId: null, origin: null, actionRevision: 0, clientRequestId: null, snoozedUntil: null, type: 'ACTION_REQUIRED', description: 'Reply to recruiter', deadline: null, deadlinePrecision: null, status: 'PENDING', createdAt: '2026-09-01', application: { companyName: 'Older Company', jobTitle: null }, email: null };
  vi.mocked(api.getWorkspaceActions).mockImplementation(async params => workspacePage(params.offset ? [] : [action], { metadata: { limit: 20, offset: params.offset, nextOffset: params.offset ? null : 20 } }));
  show('/');
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.getWorkspaceActions).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }), expect.anything()));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled());
  expect(await screen.findByText('Reply to recruiter')).toBeInTheDocument();
});
it('can select an application beyond the first 20 when linking an email', async () => {
  vi.mocked(api.listApplications).mockImplementation(async params => params?.offset ? page([application], 20) : page([{ ...application, id: 'recent', companyName: 'Recent Company' }], 0, 20));
  vi.mocked(api.getUnmatchedEmails).mockResolvedValue(page([{ id: 'email', subject: 'Interview', sender: 'hr@example.test', receivedAt: null, aiProcessingResult: null }]));
  vi.mocked(api.resolveUnmatchedEmail).mockResolvedValue({ success: true });
  show('/');
  const selector = await screen.findByRole('region', { name: 'Applications for matching' });
  fireEvent.click(within(selector).getByRole('button', { name: 'Next' }));
  await screen.findByRole('option', { name: 'Older Company' });
  const selectDropdown = await screen.findByRole('combobox', { name: /Select application to link/i });
  fireEvent.change(selectDropdown, { target: { value: 'older-app' } });
  await waitFor(() => expect(api.resolveUnmatchedEmail).toHaveBeenCalledWith('email', { applicationId: 'older-app' }));
});
it('shows a failed action mutation and permits retry', async () => {
  const action = { id: 'action-1', applicationId: 'older-app', emailId: null, origin: null, actionRevision: 0, clientRequestId: null, snoozedUntil: null, type: 'ACTION_REQUIRED', description: 'Reply', deadline: null, deadlinePrecision: null, status: 'PENDING', createdAt: '2026-09-01', application: { companyName: 'Older Company', jobTitle: null }, email: null };
  vi.mocked(api.getWorkspaceActions).mockResolvedValue(workspacePage([action]));
  vi.mocked(api.updateAction).mockRejectedValue(new Error('Network unavailable'));
  show('/');
  fireEvent.click(await screen.findByRole('button', { name: 'Complete' }));
  expect(await screen.findByText(/action update could not be confirmed/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Complete' })).toBeEnabled();
});
