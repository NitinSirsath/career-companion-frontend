// @vitest-environment jsdom
// MCP-06: "Application Submitted" precedence and the automation timeline entry (ADR-0002 §8–9).
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { statusSourceLine } from '../lib/applicationDetail';
import { applicationTag, statusTag } from '../lib/statusTags';
import {
  ApplicationStatusSchema,
  ApplicationResponseSchema,
  type ApplicationStatus,
} from '../contracts/application';
import { makeApplication, makeEvent } from './fixtures';

vi.mock('../api/client', () => ({
  api: {
    listApplications: vi.fn(),
    getApplication: vi.fn(),
    getApplicationEvents: vi.fn(),
    getApplicationActions: vi.fn(),
    getGmailStatus: vi.fn(),
  },
}));

import { routeTree } from '../routeTree.gen';

const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });
const statuses = ApplicationStatusSchema.options as ApplicationStatus[];

function renderRoute(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: { id: 'u', email: 't@test.local', name: 'T' } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const automationEvent = makeEvent({
  id: 'evt-auto',
  type: 'AUTOMATION_SUBMITTED',
  newState: null,
  description: null,
  provenance: null,
  createdAt: '2026-10-02T09:00:00.000Z',
  sourceSubmission: {
    platform: 'company_direct',
    destinationHost: 'jobs.lever.co',
    submittedAt: '2026-10-01T03:00:00.000Z',
    confirmationText: '<b>Thanks</b> for applying',
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: false,
    gmailEmail: null,
    status: 'NOT_CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
  } as never);
});
afterEach(cleanup);

describe('status precedence with submittedVia', () => {
  it('shows "Sent by automation" only when there is no status at all', () => {
    const app = makeApplication({ submittedVia: 'AUTOMATION' });
    expect(ApplicationResponseSchema.parse(app).statusSource).toBe('UNKNOWN');
    expect(applicationTag(app).label).toBe('Sent by automation');
    expect(statusSourceLine(app)).toBe('Reported by your automation');
  });

  it('keeps the plain unknown status without an automation submission', () => {
    const app = makeApplication({ submittedVia: null });
    expect(applicationTag(app).label).toBe('Status unknown');
    expect(statusSourceLine(app)).toBe('No status yet');
  });

  it.each(statuses)('an AI status (%s) always wins over submittedVia', (status) => {
    const app = makeApplication({ aiStatus: status, submittedVia: 'AUTOMATION' });
    expect(applicationTag(app).label).toBe(statusTag(status).label);
    expect(statusSourceLine(app)).toBe('Set by the AI from your mails');
  });

  it.each(statuses)(
    'a user status (%s) always wins over submittedVia, with or without AI',
    (status) => {
      for (const aiStatus of [null, 'INTERVIEW'] as const) {
        const app = makeApplication({ userStatus: status, aiStatus, submittedVia: 'AUTOMATION' });
        expect(applicationTag(app).label).toBe(statusTag(status).label);
        expect(statusSourceLine(app)).toMatch(/^Set by you/);
      }
    },
  );

  it('keeps the submission fact on the page once a status wins the tag', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(
      makeApplication({ aiStatus: 'INTERVIEW', submittedVia: 'AUTOMATION' }),
    );
    vi.mocked(api.getApplicationEvents).mockResolvedValue(page([]));
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
    renderRoute('/applications/app-1');
    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).getByText('Sent by')).toBeInTheDocument();
    expect(within(details).getByText('Your automation')).toBeInTheDocument();
  });
});

describe('timeline', () => {
  it('renders the automation event as "Sent by your automation", never as AI or email evidence', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(
      makeApplication({ submittedVia: 'AUTOMATION' }),
    );
    vi.mocked(api.getApplicationEvents).mockResolvedValue(
      page([automationEvent, makeEvent({ id: 'evt-email', description: null })]),
    );
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
    renderRoute('/applications/app-1');

    const title = await screen.findByText('Sent by your automation');
    const item = title.closest('li')!;
    const scope = within(item);
    expect(scope.getByText('Company site · jobs.lever.co')).toBeInTheDocument();
    // Submission time (as the automation reported it) and recording time are told apart.
    const times = [...item.querySelectorAll('time')].map((t) => t.getAttribute('dateTime'));
    expect(times).toEqual(['2026-10-01T03:00:00.000Z', '2026-10-02T09:00:00.000Z']);
    expect(scope.getByText(/as your automation reported it/)).toBeInTheDocument();
    expect(item.querySelectorAll('time')[1]).toHaveAttribute(
      'title',
      expect.stringMatching(/^Recorded/),
    );
    // Confirmation is plain text: markup is shown, not rendered.
    expect(scope.getByText('<b>Thanks</b> for applying')).toBeInTheDocument();
    expect(item.querySelector('b')).toBeNull();
    expect(scope.queryByRole('button', { name: 'Show the AI note' })).not.toBeInTheDocument();
    expect(scope.queryByText(/details unavailable/)).not.toBeInTheDocument();
    expect(scope.queryByText(/^The AI/)).not.toBeInTheDocument();
    // The ordinary email event keeps its own wording.
    expect(screen.getAllByText('A job mail (details unavailable)')).toHaveLength(1);
  });

  it('says when submission details are unavailable', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(makeApplication());
    vi.mocked(api.getApplicationEvents).mockResolvedValue(
      page([{ ...automationEvent, sourceSubmission: null }]),
    );
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
    renderRoute('/applications/app-1');
    expect(await screen.findByText('Submission details unavailable')).toBeInTheDocument();
    expect(screen.queryByText('A job mail (details unavailable)')).not.toBeInTheDocument();
  });

  it('shows "Sent by your automation" on the list page’s last-activity line and the automation tag', async () => {
    vi.mocked(api.listApplications).mockResolvedValue(
      page([
        makeApplication({
          submittedVia: 'AUTOMATION',
          recentEvent: {
            type: 'AUTOMATION_SUBMITTED',
            createdAt: '2026-10-02T09:00:00.000Z',
            recordedAt: '2026-10-02T09:00:00.000Z',
            sourceEmail: null,
            sourceSubmission: automationEvent.sourceSubmission,
          },
        }),
      ]),
    );
    renderRoute('/applications');
    expect(await screen.findByText('Sent by your automation')).toBeInTheDocument();
    expect(screen.getByText('Sent by automation', { selector: 'span' })).toBeInTheDocument();
  });
});
