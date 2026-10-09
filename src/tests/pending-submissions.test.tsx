// @vitest-environment jsdom
import { workspacePage } from './fixtures';
// MCP-07: dashboard panel for automation submissions that need review (ADR-0002 decision 7).
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { PendingSubmission } from '../contracts/submission';
import { safeHttpUrl } from '../lib/safeUrl';
import { makeApplication } from './fixtures';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      getGmailStatus: vi.fn(),
      listApplications: vi.fn(),
      getActions: vi.fn(),
      getWorkspaceActions: vi.fn(),
      getWorkspaceReview: vi.fn(),
      getAmbiguousEmails: vi.fn(),
      getUnmatchedEmails: vi.fn(),
      getPendingSubmissions: vi.fn(),
      resolveSubmission: vi.fn(),
      getAISettings: vi.fn(),
    },
  };
});

import { routeTree } from '../routeTree.gen';

const page = <T,>(items: T[], nextOffset: number | null = null) => ({
  items,
  metadata: { limit: 20, offset: 0, nextOffset },
});
const submission = (overrides: Partial<PendingSubmission> = {}): PendingSubmission => ({
  id: 's1',
  sourceRecordRef: '2026-10-01/10:00:00',
  platform: 'workday',
  company: 'Acme Inc.',
  jobTitle: 'Backend Engineer',
  submittedAt: '2026-10-01T10:00:00.000Z',
  receivedAt: '2026-10-01T10:01:00.000Z',
  jobUrl: 'https://acme.wd1.myworkdayjobs.com/jobs/1',
  portalJobId: 'R-1',
  destinationHost: 'acme.wd1.myworkdayjobs.com',
  discoverySource: 'linkedin',
  location: 'Pune',
  workMode: 'hybrid',
  confirmationText: 'Thank you for applying',
  ...overrides,
});
const apps = [
  makeApplication({ id: 'a1', companyName: 'Acme', jobTitle: 'Designer' }),
  makeApplication({ id: 'a2', companyName: 'Acme', jobTitle: 'Platform Engineer' }),
];

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
    context: { user: { id: 'u', email: 't@test.local', name: 'T' } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
const card = async (name = 'Submission: Acme Inc. — Backend Engineer') =>
  within(await screen.findByRole('article', { name }));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(api.getWorkspaceActions).mockResolvedValue(workspacePage());
  vi.mocked(api.getWorkspaceReview).mockResolvedValue({
    generatedAt: new Date().toISOString(),
    unmatched: 0,
    ambiguous: 0,
    pendingSubmissions: 0,
  });
  vi.mocked(api.getGmailStatus).mockResolvedValue({ connected: false } as never);
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
  vi.mocked(api.listApplications).mockResolvedValue(page(apps));
  vi.mocked(api.getActions).mockResolvedValue(page([]));
  vi.mocked(api.getAmbiguousEmails).mockResolvedValue(page([]));
  vi.mocked(api.getUnmatchedEmails).mockResolvedValue(page([]));
  vi.mocked(api.getPendingSubmissions).mockResolvedValue(page([submission()]));
});
afterEach(() => vi.restoreAllMocks());

describe('pending submissions panel', () => {
  it('lists submissions with a count and the reported fields as plain text', async () => {
    vi.mocked(api.getPendingSubmissions).mockResolvedValue(
      page(
        [
          submission(),
          submission({
            id: 's2',
            company: '<img src=x onerror=alert(1)>',
            jobTitle: 'QA',
            confirmationText: '<script>x</script>',
          }),
        ],
        20,
      ),
    );
    renderDashboard();
    const heading = await screen.findByRole('heading', {
      name: /Automation submissions to review/,
    });
    expect(heading).toHaveTextContent('2+');
    const first = await card();
    expect(
      first.getByText(/Workday · acme\.wd1\.myworkdayjobs\.com · Pune · hybrid/),
    ).toBeInTheDocument();
    expect(first.getByText('Thank you for applying')).toBeInTheDocument();
    const second = await card('Submission: <img src=x onerror=alert(1)> — QA');
    expect(second.getByText('<img src=x onerror=alert(1)> — QA')).toBeInTheDocument();
    expect(second.getByText('<script>x</script>')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"], article script')).toBeNull();
  });

  it('links a job URL only when it is http or https, safely', async () => {
    vi.mocked(api.getPendingSubmissions).mockResolvedValue(
      page([submission(), submission({ id: 's2', jobTitle: 'QA', jobUrl: 'javascript:alert(1)' })]),
    );
    renderDashboard();
    const link = (await card()).getByRole('link', { name: 'Open job posting' });
    expect(link).toHaveAttribute('href', 'https://acme.wd1.myworkdayjobs.com/jobs/1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect((await card('Submission: Acme Inc. — QA')).queryByRole('link')).not.toBeInTheDocument();
    expect(safeHttpUrl('data:text/html,x')).toBeNull();
    expect(safeHttpUrl('not a url')).toBeNull();
  });

  it('links to a chosen application with an explicit Link button (keyboard friendly)', async () => {
    vi.mocked(api.resolveSubmission).mockResolvedValue({
      id: 's1',
      matchState: 'LINKED',
      applicationId: 'a2',
    });
    renderDashboard();
    const c = await card();
    const select = c.getByRole('combobox', { name: 'Link to an existing application' });
    const linkButton = c.getByRole('button', { name: 'Link' });
    expect(linkButton).toBeDisabled();
    fireEvent.change(select, { target: { value: 'a2' } });
    expect(api.resolveSubmission).not.toHaveBeenCalled(); // choosing never submits by itself
    expect(linkButton).toBeEnabled();
    fireEvent.click(linkButton);
    await waitFor(() =>
      expect(api.resolveSubmission).toHaveBeenCalledWith('s1', {
        action: 'link',
        applicationId: 'a2',
      }),
    );
    await waitFor(() => expect(api.getPendingSubmissions).toHaveBeenCalledTimes(2));
  });

  it.each([
    ['Create application', { action: 'create' }],
    ['Ignore', { action: 'ignore' }],
  ])('%s resolves with %j', async (label, request) => {
    vi.mocked(api.resolveSubmission).mockResolvedValue({
      id: 's1',
      matchState: 'CREATED',
      applicationId: 'new',
    });
    renderDashboard();
    fireEvent.click((await card()).getByRole('button', { name: label }));
    await waitFor(() => expect(api.resolveSubmission).toHaveBeenCalledWith('s1', request));
  });

  it('an uncertain outcome refreshes the list and is never resent', async () => {
    vi.mocked(api.resolveSubmission).mockRejectedValue(new ApiError('Network error.', 'network'));
    renderDashboard();
    fireEvent.click((await card()).getByRole('button', { name: 'Ignore' }));
    expect(await screen.findByText(/could not confirm whether this was saved/)).toBeInTheDocument();
    await waitFor(() => expect(api.getPendingSubmissions).toHaveBeenCalledTimes(2));
    expect(api.resolveSubmission).toHaveBeenCalledTimes(1);
  });

  it('explains a submission that was already resolved elsewhere', async () => {
    vi.mocked(api.resolveSubmission).mockRejectedValue(
      new ApiError('Not resolvable', 'http', 400, 'BAD_REQUEST'),
    );
    renderDashboard();
    fireEvent.click((await card()).getByRole('button', { name: 'Create application' }));
    expect(await screen.findByText(/already resolved/)).toBeInTheDocument();
  });

  it('is hidden when nothing needs review', async () => {
    vi.mocked(api.getPendingSubmissions).mockResolvedValue(page([]));
    renderDashboard();
    await screen.findByRole('heading', { name: 'Dashboard' });
    await waitFor(() => expect(api.getPendingSubmissions).toHaveBeenCalled());
    expect(
      screen.queryByRole('heading', { name: /Automation submissions to review/ }),
    ).not.toBeInTheDocument();
  });
});
