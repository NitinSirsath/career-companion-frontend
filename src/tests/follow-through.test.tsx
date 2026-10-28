// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ArchiveControl } from '../components/ArchiveControl';
import { SnoozeControl } from '../components/FollowThrough';
import { api } from '../api/client';
import { makeApplication } from './fixtures';
import {
  applyAcknowledgedApplication,
  fetchApplicationsPage,
  preferNewerManualState,
} from '../lib/applicationCache';
import type { ActionWithContextResponse } from '../contracts';
vi.mock('../api/client', async (original) => ({
  ...(await original<typeof import('../api/client')>()),
  api: {
    snoozeAction: vi.fn(),
    archiveApplication: vi.fn(),
    listApplications: vi.fn(),
  },
}));
// A fixed browser zone, so the local time of a deadline is known.
vi.mock('../lib/workspace', async (original) => ({
  ...(await original<typeof import('../lib/workspace')>()),
  browserTimeZone: () => 'Asia/Kolkata',
}));
const action: ActionWithContextResponse = {
  id: 'action',
  applicationId: 'app-1',
  emailId: null,
  type: 'USER_FOLLOW_UP',
  description: 'Follow up',
  deadline: null,
  deadlinePrecision: null,
  status: 'PENDING',
  createdAt: '2026-10-03T00:00:00Z',
  origin: 'USER',
  actionRevision: 3,
  clientRequestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  snoozedUntil: null,
  application: { companyName: 'Fixture', jobTitle: null },
  email: null,
};
function show(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 3 } },
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it('unsnoozes using the captured revision without sending a deadline change', async () => {
  vi.mocked(api.snoozeAction).mockResolvedValue(action);
  show(<SnoozeControl action={{ ...action, snoozedUntil: '2099-10-03T00:00:00Z' }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Change snooze' }));
  fireEvent.click(screen.getByRole('button', { name: 'Unsnooze' }));
  await waitFor(() =>
    expect(api.snoozeAction).toHaveBeenCalledWith('action', {
      expectedActionRevision: 3,
      snoozedUntil: null,
    }),
  );
});
it('archive acknowledges the new revision and removes the active list entry', async () => {
  const app = makeApplication();
  const archived = makeApplication({
    archivedAt: '2026-10-03T00:00:00Z',
    archiveRevision: 1,
  });
  vi.mocked(api.archiveApplication).mockResolvedValue(archived);
  const client = show(<ArchiveControl application={app} />);
  client.setQueryData(['applications', { archive: 'active' }], {
    items: [app],
    metadata: { limit: 20, offset: 0, nextOffset: null },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Archive application' }));
  fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
  await waitFor(() =>
    expect(client.getQueryData(['application', 'app-1'])).toMatchObject({
      archiveRevision: 1,
    }),
  );
  expect(client.getQueryData(['applications', { archive: 'active' }])).toMatchObject({ items: [] });
});
it('late reads cannot repaint a newer archive while independent manual status survives', async () => {
  const client = new QueryClient(),
    old = makeApplication(),
    archived = makeApplication({
      archiveRevision: 2,
      archivedAt: '2026-10-03T00:00:00Z',
    });
  applyAcknowledgedApplication(client, archived);
  expect(
    preferNewerManualState(
      archived,
      makeApplication({ userStatus: 'OFFER', userStatusRevision: 5 }),
    ),
  ).toMatchObject({
    archiveRevision: 2,
    userStatusRevision: 5,
    archivedAt: archived.archivedAt,
  });
  vi.mocked(api.listApplications).mockResolvedValue({
    items: [old],
    metadata: { limit: 20, offset: 0, nextOffset: null },
  });
  await expect(
    fetchApplicationsPage(client, { offset: 0, limit: 20, archive: 'active' }),
  ).rejects.toMatchObject({ kind: 'contract' });
  expect(api.listApplications).toHaveBeenCalledTimes(2);
});
