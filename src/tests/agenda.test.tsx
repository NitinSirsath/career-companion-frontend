// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import { api, ApiError } from '../api/client';
import { resolveTemporal } from '../contracts/temporal';
import type { AgendaItem } from '../contracts/agenda';
vi.mock('../api/client', async (original) => ({
  ...(await original<typeof import('../api/client')>()),
  api: { getAgenda: vi.fn(), updateAgenda: vi.fn() },
}));
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const timing = resolveTemporal({
  date: '2026-10-04',
  time: null,
  sourceTimeZone: null,
});
const item: AgendaItem = {
  applicationArchived: false,
  id,
  applicationId: id,
  emailId: id,
  candidateKey: 'v3:0',
  extractionVersion: 'extraction/v3',
  suggestion: {
    key: 'v3:0',
    kind: 'INTERVIEW',
    change: 'RESCHEDULED',
    rawWhen: 'October 4',
    date: '2026-10-04',
    time: null,
    sourceTimeZone: null,
    evidence: 'Interview October 4',
    temporal: timing,
  },
  timing,
  state: 'TENTATIVE',
  revision: 3,
  decisionSourceId: null,
  retiredAt: null,
  retiredReason: null,
  createdAt: '2026-10-03T00:00:00Z',
  updatedAt: '2026-10-03T00:00:00Z',
  application: { companyName: 'Fixture company', jobTitle: null },
  email: { subject: 'Interview', threadId: null },
};
const page = {
  items: [item],
  metadata: { limit: 20, offset: 0, nextOffset: null },
  generatedAt: '2026-10-03T00:00:00Z',
  timeZone: 'Asia/Kolkata',
  extractionEnabled: false,
};
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 3 } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/agenda'] }),
    context: { user: { id, email: 'fixture@test.local', name: 'Fixture' } },
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getAgenda).mockResolvedValue(page);
});
afterEach(cleanup);
it('shows date precision, original evidence and separate reschedule intent', async () => {
  show();
  expect(await screen.findByText('2026-10-04 · Time not specified')).toBeVisible();
  expect(screen.getByText(/New agenda suggestions are currently disabled/)).toBeVisible();
  expect(screen.getByText(/saving here does not change another event/)).toBeVisible();
  fireEvent.click(screen.getByText('Original suggestion and source'));
  expect(screen.getByText('Interview October 4')).toBeVisible();
});
it('captures revision, saves once, and preserves source suggestion', async () => {
  vi.mocked(api.updateAgenda).mockResolvedValue({
    ...item,
    state: 'CONFIRMED',
    revision: 4,
  });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Review / edit' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
  await waitFor(() => expect(api.updateAgenda).toHaveBeenCalledTimes(1));
  expect(api.updateAgenda).toHaveBeenCalledWith(id, {
    expectedRevision: 3,
    state: 'CONFIRMED',
    timing: { date: '2026-10-04', time: null, sourceTimeZone: null },
  });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
it('rejects missing source timezone in a timed edit', async () => {
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Review / edit' }));
  fireEvent.change(screen.getByLabelText(/Time \(leave/), {
    target: { value: '14:30' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('explicit timezone');
  expect(api.updateAgenda).not.toHaveBeenCalled();
});
it.each([new ApiError('stale', 'http', 409, 'REVISION_CONFLICT'), new ApiError('lost', 'network')])(
  'reconciles failed writes without replay or silently rebasing',
  async (error) => {
    vi.mocked(api.updateAgenda).mockRejectedValue(error);
    const client = show();
    fireEvent.click(await screen.findByRole('button', { name: 'Review / edit' }));
    fireEvent.change(screen.getByLabelText('Date'), {
      target: { value: '2026-10-05' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save item' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save item' })).toBeDisabled());
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-05');
    expect(api.updateAgenda).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.getAgenda).toHaveBeenCalledTimes(2));
    client.clear();
  },
);
it('keeps read failure distinct from empty agenda', async () => {
  vi.mocked(api.getAgenda).mockRejectedValue(Error('offline'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('could not be refreshed');
  expect(screen.queryByText('No stored items in this view.')).not.toBeInTheDocument();
});
