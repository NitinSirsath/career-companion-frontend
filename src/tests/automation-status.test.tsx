// @vitest-environment jsdom
// MCP-06: "Application Submitted" precedence and the automation timeline entry (ADR-0002 §8–9).
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { EffectiveStatus } from '../components/ApplicationStatus';
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
  it('shows "Application Submitted" only when there is no status at all', () => {
    const app = makeApplication({ submittedVia: 'AUTOMATION' });
    expect(ApplicationResponseSchema.parse(app).statusSource).toBe('UNKNOWN');
    render(<EffectiveStatus app={app} />);
    expect(screen.getByText('Application Submitted', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('Reported by your automation')).toBeInTheDocument();
    expect(screen.queryByText('Status unknown')).not.toBeInTheDocument();
  });

  it('keeps the plain unknown status without an automation submission', () => {
    render(<EffectiveStatus app={makeApplication({ submittedVia: null })} />);
    expect(screen.getByText('Status unknown')).toBeInTheDocument();
    expect(
      screen.queryByText('Application Submitted', { selector: 'div' }),
    ).not.toBeInTheDocument();
  });

  it.each(statuses)('an AI status (%s) always wins over submittedVia', (status) => {
    render(
      <EffectiveStatus app={makeApplication({ aiStatus: status, submittedVia: 'AUTOMATION' })} />,
    );
    expect(screen.getByText('Inferred by AI')).toBeInTheDocument();
    expect(
      screen.queryByText('Application Submitted', { selector: 'div' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Submitted via automation')).toHaveLength(1);
  });

  it.each(statuses)(
    'a user status (%s) always wins over submittedVia, with or without AI',
    (status) => {
      render(
        <>
          <EffectiveStatus
            app={makeApplication({ userStatus: status, submittedVia: 'AUTOMATION' })}
          />
          <EffectiveStatus
            app={makeApplication({
              userStatus: status,
              aiStatus: 'INTERVIEW',
              submittedVia: 'AUTOMATION',
            })}
          />
        </>,
      );
      expect(screen.getAllByText('Set by you')).toHaveLength(2);
      expect(
        screen.queryByText('Application Submitted', { selector: 'div' }),
      ).not.toBeInTheDocument();
      expect(screen.getAllByText('Submitted via automation')).toHaveLength(2);
    },
  );
});

describe('timeline', () => {
  it('renders the automation event as "Submitted via automation", never as AI or email evidence', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(
      makeApplication({ submittedVia: 'AUTOMATION' }),
    );
    vi.mocked(api.getApplicationEvents).mockResolvedValue(
      page([automationEvent, makeEvent({ id: 'evt-email', description: null })]),
    );
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
    renderRoute('/applications/app-1');

    const title = await screen.findByText('Submitted via automation');
    const item = title.closest('li')!;
    const scope = within(item);
    expect(
      scope.getByText(/Reported by your automation · Company site · jobs\.lever\.co/),
    ).toBeInTheDocument();
    // Submission time and recording time are labelled separately.
    const times = [...item.querySelectorAll('time')].map((t) => [
      t.parentElement!.textContent!.split(' ')[0],
      t.getAttribute('dateTime'),
    ]);
    expect(times).toEqual([
      ['Recorded', '2026-10-02T09:00:00.000Z'],
      ['Submitted', '2026-10-01T03:00:00.000Z'],
    ]);
    // Confirmation is plain text: markup is shown, not rendered.
    expect(scope.getByText('<b>Thanks</b> for applying')).toBeInTheDocument();
    expect(item.querySelector('b')).toBeNull();
    expect(scope.queryByText(/AI interpretation/)).not.toBeInTheDocument();
    expect(scope.queryByText('Source email unavailable')).not.toBeInTheDocument();
    expect(scope.queryByText(/AI status/)).not.toBeInTheDocument();
    // The ordinary email event keeps its existing labels.
    expect(screen.getAllByText('Source email unavailable')).toHaveLength(1);
  });

  it('says when submission details are unavailable', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(makeApplication());
    vi.mocked(api.getApplicationEvents).mockResolvedValue(
      page([{ ...automationEvent, sourceSubmission: null }]),
    );
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
    renderRoute('/applications/app-1');
    expect(await screen.findByText('Submission details unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Source email unavailable')).not.toBeInTheDocument();
  });

  it('shows "Submitted via automation" on the list page’s recent-event line and the automation badge', async () => {
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
    expect(await screen.findByText('Submitted via automation')).toBeInTheDocument();
    expect(screen.getByText('Application Submitted', { selector: 'div' })).toBeInTheDocument();
  });
});
