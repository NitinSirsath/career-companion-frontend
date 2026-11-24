// @vitest-environment jsdom
// NorthList Apply runs as tasks on the Apply page's Submitted tab (owner, 25 Nov 2026).
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApplyTask, ListApplyTasksResponse } from '../contracts/submission';
import { duration, planItemCount, siteName, taskMinutes, taskName } from '../lib/applyTask';
import { routeTree } from '../routeTree.gen';
import { makeApplication } from './fixtures';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      getGmailStatus: vi.fn(),
      getPendingSubmissions: vi.fn(),
      listApplications: vi.fn(),
      getNotSubmittedJobs: vi.fn(),
      getApplyTasks: vi.fn(),
    },
  };
});

const page = <T,>(items: T[], nextOffset: number | null = null) => ({
  items,
  metadata: { limit: 20, offset: 0, nextOffset },
});
const NIGHT = '7b0a7c43-58b6-4d64-9f6b-3a0b1c2d3e4f';
const MORNING = '2c1d0e9f-8a7b-4c6d-9e5f-4a3b2c1d0e9f';
const task = (overrides: Partial<ApplyTask> = {}): ApplyTask => ({
  id: NIGHT,
  startedAt: '2026-11-24T15:32:00.000Z', // 9:02 pm at +05:30
  utcOffsetMinutes: 330,
  lastAt: '2026-11-24T16:36:00.000Z',
  sent: 10,
  notSent: 2,
  plan: [
    { site: 'linkedin', planned: 10, sent: 8 },
    { site: 'naukri', planned: 2, sent: 2 },
  ],
  ...overrides,
});
const tasks = (
  items: ApplyTask[],
  summary: Partial<ListApplyTasksResponse['summary']> = {},
  nextOffset: number | null = null,
): ListApplyTasksResponse => ({
  ...page(items, nextOffset),
  summary: { tasks: items.length, sent: 12, minutes: 111, earlier: 0, ...summary },
});

function show(path = '/automation') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: { id: 'u', email: 'u@test.local', name: 'U' } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getGmailStatus).mockResolvedValue({ connected: false } as never);
  vi.mocked(api.getPendingSubmissions).mockResolvedValue(page([]));
  vi.mocked(api.getNotSubmittedJobs).mockResolvedValue(page([]));
  // Each run's applications: the night run, Earlier ('none'), and any other list.
  const byTask: Record<string, string> = { [NIGHT]: 'Razorpay', none: 'Old Co' };
  vi.mocked(api.listApplications).mockImplementation(async (params) => {
    const companyName = byTask[params?.applyTask ?? ''] ?? 'Philips';
    return page([makeApplication({ id: companyName, companyName, submittedVia: 'AUTOMATION' })]);
  });
});
afterEach(cleanup);

describe('names and times', () => {
  const now = new Date('2026-11-25T09:10:00Z'); // Wed 25 Nov, 2:40 pm at +05:30
  const at = (startedAt: string, utcOffsetMinutes = 330) =>
    taskName({ startedAt, utcOffsetMinutes }, now);
  it('names a run by its start in the user’s time then', () => {
    expect(at('2026-11-25T04:45:00Z')).toBe('Today 10:15 am');
    expect(at('2026-11-24T15:32:00Z')).toBe('Yesterday 9:02 pm');
    expect(at('2026-11-23T15:10:00Z')).toBe('Monday 8:40 pm');
    expect(at('2026-11-16T06:30:00Z')).toBe('Mon 16 Nov, 12:00 pm');
    expect(at('2025-12-30T10:00:00Z')).toBe('Tue 30 Dec 2025, 3:30 pm');
    // The day turns at the user's midnight, not at UTC midnight.
    expect(at('2026-11-24T19:00:00Z')).toBe('Today 12:30 am');
    expect(at('2026-11-25T01:00:00Z', -300)).toBe('Yesterday 8:00 pm');
  });
  it('says how long a run took', () => {
    expect(duration(47)).toBe('47 min');
    expect(duration(64)).toBe('1 h 4 min');
    expect(duration(120)).toBe('2 h');
    expect(duration(0.2)).toBe('1 min');
    expect(taskMinutes(task())).toBe(64);
    expect(taskMinutes(task({ lastAt: null }))).toBeNull();
  });
  it('writes each plan item with its count', () => {
    expect(siteName('the_reliable_jobs')).toBe('The Reliable Jobs');
    expect(siteName('linkedin')).toBe('LinkedIn');
    expect(planItemCount({ site: 'linkedin', planned: 10, sent: 8 })).toBe('8 of 10');
    expect(planItemCount({ site: 'naukri', planned: null, sent: 2 })).toBe('2');
  });
});

describe('Submitted tab, by task', () => {
  it('shows the totals and one row per run, the newest open with its applications', async () => {
    vi.mocked(api.getApplyTasks).mockResolvedValue(
      tasks([
        task({
          id: MORNING,
          startedAt: '2026-11-25T04:45:00.000Z',
          lastAt: '2026-11-25T05:32:00.000Z',
          sent: 2,
          notSent: 0,
          plan: [{ site: 'workday', planned: 3, sent: 2 }],
        }),
        task(),
      ]),
    );
    show();
    const list = await screen.findByRole('list', { name: 'Tasks' });
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute('aria-expanded', 'true');
    expect(rows[1]).toHaveAttribute('aria-expanded', 'false');
    expect(within(list).getByText('2 of 3 sent')).toBeInTheDocument();
    expect(within(list).getByText('47 min')).toBeInTheDocument();
    expect(within(list).getByText('10 of 12 sent')).toBeInTheDocument();
    expect(within(list).getByText('1 h 4 min')).toBeInTheDocument();
    expect(within(list).getByText('8 of 10')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: '2 not sent' })).toHaveAttribute(
      'href',
      '/automation?tab=not-submitted',
    );
    // Totals: 2 tasks, 12 sent, 1 h 51 min, about 9 min each.
    expect(screen.getByText('1 h 51 min')).toBeInTheDocument();
    expect(screen.getByText('about 9 min')).toBeInTheDocument();
    expect(await within(list).findByRole('link', { name: 'Philips' })).toBeInTheDocument();

    fireEvent.click(rows[1]);
    expect(rows[1]).toHaveAttribute('aria-expanded', 'true');
    expect(await within(list).findByRole('link', { name: 'Razorpay' })).toBeInTheDocument();
    expect(api.listApplications).toHaveBeenCalledWith(
      expect.objectContaining({ submittedVia: 'AUTOMATION', archive: 'all', applyTask: NIGHT }),
      expect.anything(),
    );
  });

  it('puts applications sent before runs in one last group, Earlier', async () => {
    vi.mocked(api.getApplyTasks).mockResolvedValue(tasks([task()], { earlier: 3 }));
    show();
    const earlier = await screen.findByRole('button', { name: 'Earlier' });
    expect(earlier).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Sent before tasks were added')).toBeInTheDocument();
    expect(screen.getByText('3 sent')).toBeInTheDocument();
    fireEvent.click(earlier);
    expect(await screen.findByRole('link', { name: 'Old Co' })).toBeInTheDocument();
  });

  it('opens Earlier when an older Apply version sent everything', async () => {
    vi.mocked(api.getApplyTasks).mockResolvedValue(
      tasks([], { tasks: 0, sent: 0, minutes: 0, earlier: 5 }),
    );
    show();
    expect(await screen.findByRole('button', { name: 'Earlier' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.queryByText('tasks')).toBeNull();
  });

  it('shows the empty state when nothing was sent', async () => {
    vi.mocked(api.getApplyTasks).mockResolvedValue(
      tasks([], { tasks: 0, sent: 0, minutes: 0, earlier: 0 }),
    );
    show();
    expect(await screen.findByText('Nothing sent yet')).toBeInTheDocument();
  });

  it('pages the runs and shows Earlier only on the last page', async () => {
    vi.mocked(api.getApplyTasks).mockImplementation(async (params) =>
      params?.offset
        ? {
            ...tasks([task({ id: MORNING })], { earlier: 1 }),
            metadata: { limit: 10, offset: 10, nextOffset: null },
          }
        : tasks([task()], { earlier: 1 }, 10),
    );
    show();
    await screen.findByRole('list', { name: 'Tasks' });
    expect(screen.queryByRole('button', { name: 'Earlier' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByRole('button', { name: 'Earlier' })).toBeInTheDocument();
    expect(api.getApplyTasks).toHaveBeenLastCalledWith(
      { offset: 10, limit: 10 },
      expect.anything(),
    );
  });

  it('offers a retry when the runs cannot load', async () => {
    vi.mocked(api.getApplyTasks).mockRejectedValue(new Error('down'));
    show();
    expect(
      await screen.findByText('Could not load the tasks your automation ran.'),
    ).toBeInTheDocument();
  });

  it('keeps the old single list under All', async () => {
    vi.mocked(api.getApplyTasks).mockResolvedValue(tasks([task()]));
    show();
    fireEvent.click(await screen.findByRole('tab', { name: 'All' }));
    expect(await screen.findByRole('link', { name: 'Philips' })).toBeInTheDocument();
    await waitFor(() =>
      expect(api.listApplications).toHaveBeenCalledWith(
        { offset: 0, limit: 20, submittedVia: 'AUTOMATION', archive: 'all' },
        expect.anything(),
      ),
    );
  });
});
