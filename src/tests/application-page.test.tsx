// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import { ToastProvider } from '../components/ui/toast';
import type { ApplicationActionListItem } from '../contracts/application';
import type { ActionWithContextResponse } from '../contracts';
import { historyEntry, mailPeople, stepSource } from '../lib/applicationDetail';
import { timeZones, zoneOffset } from '../lib/timeZones';
import { routeTree } from '../routeTree.gen';
import { makeApplication, makeEvent } from './fixtures';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      getGmailStatus: vi.fn(),
      getApplication: vi.fn(),
      getApplicationEvents: vi.fn(),
      getApplicationActions: vi.fn(),
      updateAction: vi.fn(),
      archiveApplication: vi.fn(),
    },
  };
});

const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });

function step(overrides: Partial<ApplicationActionListItem> = {}): ApplicationActionListItem {
  return {
    origin: 'EMAIL',
    actionRevision: 4,
    clientRequestId: null,
    snoozedUntil: null,
    id: 'step-1',
    applicationId: 'app-1',
    emailId: 'mail-1',
    type: 'ACTION_REQUIRED',
    description: 'Confirm the interview time',
    deadline: null,
    deadlinePrecision: null,
    status: 'PENDING',
    createdAt: '2026-10-01T10:00:00Z',
    repliedAt: null,
    askKind: null,
    closedReason: null,
    ...overrides,
  };
}

const arjunMail = makeEvent({
  id: 'evt-1',
  emailId: 'mail-1',
  oldState: 'ASSESSMENT',
  newState: 'INTERVIEW',
  sourceEmail: {
    id: 'mail-1',
    subject: 'Next step: technical interview',
    sender: 'Arjun Mehta <arjun@quanta.example>',
    receivedAt: '2026-10-01T09:00:00Z',
  },
});

function show() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/applications/app-1'] }),
    context: { user: { id: 'u', email: 'u@test.local', name: 'U' } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue(page([]));
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: false,
    gmailEmail: null,
    status: 'NOT_CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
  } as never);
  vi.mocked(api.getApplication).mockResolvedValue(
    makeApplication({ companyName: 'Quanta Labs', aiStatus: 'INTERVIEW' }),
  );
  vi.mocked(api.getApplicationEvents).mockResolvedValue(page([arjunMail]));
  vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
});
afterEach(cleanup);

describe('next steps', () => {
  it('says which mail a step came from and links to it', async () => {
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([step()]));
    show();
    const link = await screen.findByRole('link', { name: "From Arjun Mehta's mail" });
    expect(link).toHaveAttribute('href', '/mails/mail-1');
  });

  it('completes a step of the user own and lets the user undo it from the toast', async () => {
    const own = { origin: 'USER' as const, emailId: null };
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([step(own)]));
    vi.mocked(api.updateAction).mockResolvedValue({
      ...step({ ...own, status: 'COMPLETED', actionRevision: 5 }),
      application: { companyName: 'Quanta Labs', jobTitle: null },
      email: null,
    } as ActionWithContextResponse);
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'Complete' }));
    await waitFor(() =>
      expect(api.updateAction).toHaveBeenCalledWith('step-1', {
        status: 'COMPLETED',
        expectedActionRevision: 4,
      }),
    );
    expect(await screen.findByText('Done: Confirm the interview time')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(api.updateAction).toHaveBeenLastCalledWith('step-1', {
        status: 'PENDING',
        expectedActionRevision: 5,
      }),
    );
  });

  it('keeps Snooze and Dismiss in the step menu, and no Edit, also for the user own follow-ups', async () => {
    vi.mocked(api.getApplicationActions).mockResolvedValue(
      page([step(), step({ id: 'step-2', origin: 'USER', description: 'Thank Arjun' })]),
    );
    show();
    fireEvent.click(
      await screen.findByRole('button', { name: 'More for Confirm the interview time' }),
    );
    expect(await screen.findByRole('menuitem', { name: 'Snooze…' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit…' })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'More for Thank Arjun' }));
    expect(await screen.findByRole('menuitem', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit…' })).not.toBeInTheDocument();
  });

  it('has no Complete on a step from a mail; "I did this" only on one done outside mail', async () => {
    vi.mocked(api.getApplicationActions).mockResolvedValue(
      page([
        step({ askKind: 'REPLY_BY_MAIL' }),
        step({ id: 'step-2', description: 'Fill in the survey', askKind: 'OUTSIDE_MAIL' }),
      ]),
    );
    vi.mocked(api.updateAction).mockResolvedValue({
      ...step({ id: 'step-2', status: 'COMPLETED', actionRevision: 5 }),
      application: { companyName: 'Quanta Labs', jobTitle: null },
      email: null,
    } as ActionWithContextResponse);
    show();
    const steps = await screen.findByRole('region', { name: 'Next steps' });
    await within(steps).findByText('Fill in the survey');
    expect(within(steps).queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    expect(within(steps).getByText(/Steps from mails close by themselves/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More for Confirm the interview time' }));
    expect(await screen.findByRole('menuitem', { name: 'Snooze…' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'I did this' })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'More for Fill in the survey' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'I did this' }));
    await waitFor(() =>
      expect(api.updateAction).toHaveBeenCalledWith('step-2', {
        status: 'COMPLETED',
        expectedActionRevision: 4,
      }),
    );
  });

  it('says why each finished step closed', async () => {
    vi.mocked(api.getApplicationActions).mockResolvedValue(
      page([
        step({
          id: 'old-1',
          description: 'Send your CV',
          status: 'COMPLETED',
          closedReason: 'YOUR_REPLY',
        }),
        step({
          id: 'old-2',
          description: 'Book a slot',
          status: 'COMPLETED',
          closedReason: 'REPLACED_BY_MAIL',
        }),
      ]),
    );
    show();
    const steps = await screen.findByRole('region', { name: 'Next steps' });
    fireEvent.click(await within(steps).findByRole('button', { name: 'Done (2)' }));
    expect(within(steps).getByText('Your reply answered it')).toBeInTheDocument();
    expect(within(steps).getByText('Replaced by a newer mail')).toBeInTheDocument();
  });

  it('folds finished steps under "Done" and never shows the raw state', async () => {
    vi.mocked(api.getApplicationActions).mockResolvedValue(
      page([
        step(),
        step({ id: 'old-1', description: 'Send the portfolio', status: 'COMPLETED' }),
        step({ id: 'old-2', description: 'Book a call', status: 'DISMISSED' }),
      ]),
    );
    show();
    const steps = await screen.findByRole('region', { name: 'Next steps' });
    expect(await within(steps).findByText('1 open')).toBeInTheDocument();
    expect(within(steps).queryByText('Send the portfolio')).not.toBeInTheDocument();
    fireEvent.click(within(steps).getByRole('button', { name: 'Done (2)' }));
    expect(within(steps).getByText('Send the portfolio')).toBeInTheDocument();
    expect(within(steps).getByText('Dismissed')).toBeInTheDocument();
    expect(within(steps).queryByText(/COMPLETED|DISMISSED|PENDING/)).not.toBeInTheDocument();
  });
});

describe('page header', () => {
  it('archives only after the user confirms, from the "…" menu', async () => {
    vi.mocked(api.archiveApplication).mockResolvedValue(
      makeApplication({
        companyName: 'Quanta Labs',
        archivedAt: '2026-10-18T00:00:00Z',
        archiveRevision: 1,
      }),
    );
    show();
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Archive application…' }));
    expect(await screen.findByText('Archive this application?')).toBeInTheDocument();
    expect(api.archiveApplication).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() =>
      expect(api.archiveApplication).toHaveBeenCalledWith('app-1', {
        expectedArchiveRevision: 0,
        archived: true,
      }),
    );
  });

  it('shows an archived application read-only, with a way to restore it', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(
      makeApplication({ companyName: 'Quanta Labs', archivedAt: '2026-10-18T00:00:00Z' }),
    );
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([step()]));
    show();
    expect(await screen.findByText(/^Archived\. Its mails and history stay/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Change status/ })).not.toBeInTheDocument();
    expect(await screen.findByText('Confirm the interview time')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Restore this application?')).toBeInTheDocument();
  });
});

describe('side column', () => {
  it('lists the people who wrote its mails', async () => {
    show();
    const people = await screen.findByRole('region', { name: 'People in its mails' });
    expect(within(people).getByText('Arjun Mehta')).toBeInTheDocument();
    expect(within(people).getByText('arjun@quanta.example')).toBeInTheDocument();
  });
});

describe('plain-word helpers', () => {
  it('words a mail in the history as who wrote it and what the AI did', () => {
    expect(historyEntry(arjunMail)).toEqual({
      title: 'Mail from Arjun Mehta: Next step: technical interview',
      mailId: 'mail-1',
      detail: 'The AI moved the status from Assessment to Interview',
      kind: 'mail',
    });
  });

  it('says where a step came from', () => {
    const senders = new Map([['mail-1', 'Arjun Mehta']]);
    expect(stepSource(step(), senders)).toEqual({
      text: "From Arjun Mehta's mail",
      mailId: 'mail-1',
    });
    expect(stepSource(step({ emailId: 'mail-9' }), senders)?.text).toBe('From a mail');
    expect(stepSource(step({ origin: 'USER', emailId: null }), senders)?.text).toBe(
      'Your own follow-up',
    );
  });

  it('lists each person once, and not from mails moved away', () => {
    const moved = makeEvent({
      id: 'evt-2',
      retiredAt: '2026-10-02T00:00:00Z',
      retiredReason: 'EMAIL_MOVED',
      sourceEmail: { id: 'm2', subject: null, sender: 'Lena <lena@x.example>', receivedAt: null },
    });
    expect(mailPeople([arjunMail, arjunMail, moved])).toEqual([
      { name: 'Arjun Mehta', address: 'arjun@quanta.example' },
    ]);
  });

  it("starts the time zone list with the computer's zone and shows offsets", () => {
    const zones = timeZones('Asia/Kolkata');
    expect(zones[0]).toBe('Asia/Kolkata');
    expect(zones[1]).toBe('UTC');
    expect(zones.filter((zone) => zone === 'Asia/Kolkata')).toHaveLength(1);
    expect(zoneOffset('Asia/Kolkata')).toBe('UTC+05:30');
    expect(zoneOffset('UTC')).toBe('UTC+00:00');
  });
});
