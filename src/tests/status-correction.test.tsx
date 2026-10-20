// @vitest-environment jsdom
import { workspacePage } from './fixtures';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiClient, ApiError, api } from '../api/client';
import { routeTree } from '../routeTree.gen';
import { resetProcessingRefresh } from '../lib/processingRefresh';
import {
  fetchApplicationsPage,
  applicationQueryOptions,
  applyAcknowledgedApplication,
  preferNewerManualState,
} from '../lib/applicationCache';
import type { ApplicationResponse, PaginatedResponse } from '../contracts';
import { makeApplication, makeEvent } from './fixtures';
import { chooseOption } from './choose';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    api: {
      getGmailStatus: vi.fn(),
      listApplications: vi.fn(),
      getApplication: vi.fn(),
      createApplication: vi.fn(),
      updateApplicationStatus: vi.fn(),
      getApplicationEvents: vi.fn(),
      getApplicationActions: vi.fn(),
      getActions: vi.fn(),
      getWorkspaceActions: vi.fn(),
      getWorkspaceReview: vi.fn(),
      getAmbiguousEmails: vi.fn(),
      getUnmatchedEmails: vi.fn(),
      getPendingSubmissions: vi.fn(),
    },
  };
});

const page = <T,>(items: T[]): PaginatedResponse<T> => ({
  items,
  metadata: { limit: 20, offset: 0, nextOffset: null },
});
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};
const base = makeApplication({ aiStatus: 'INTERVIEW' });
const withUser = (
  userStatus: ApplicationResponse['userStatus'],
  userStatusRevision: number,
  extra: Partial<ApplicationResponse> = {},
) =>
  makeApplication({
    aiStatus: 'INTERVIEW',
    userStatus,
    userStatusRevision,
    userStatusSetAt: userStatus ? '2026-09-01T00:00:00.000Z' : null,
    ...extra,
  });
const conflict = () => new ApiError('changed elsewhere', 'http', 409, 'STATUS_CONFLICT');

let queryClient: QueryClient;
// Mutations default to retrying here, so "called once" assertions prove the explicit retry:false.
function show(path = '/applications/app-1', prepare?: (qc: QueryClient) => void) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 3, retryDelay: 0 } },
  });
  prepare?.(queryClient);
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
// The status dropdown in the page header.
const statusBox = () => screen.findByRole('combobox', { name: /Change status/ });
const OPTION_NAME: Record<string, string | RegExp> = {
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  AI: /^Use the AI's status/,
};
const choose = async (value: string) => chooseOption(await statusBox(), OPTION_NAME[value]);
// The box that holds the status notice and takes focus after a failed save.
const noticeBox = (text: string | RegExp) =>
  screen.getByText(text).closest('[tabindex="-1"]') as HTMLElement;
// The header's hidden live region, which says "Status saved.".
const liveRegion = () => document.querySelector('.sr-only[aria-live="polite"]');
// Starts a background refetch without waiting for it (it may be deliberately held).
const refetchDetail = () =>
  act(async () => {
    void queryClient.invalidateQueries({ queryKey: ['application', 'app-1'] });
  });

beforeEach(() => {
  vi.resetAllMocks();
  resetProcessingRefresh();
  vi.mocked(api.getWorkspaceActions).mockResolvedValue(workspacePage());
  vi.mocked(api.getWorkspaceReview).mockResolvedValue({
    generatedAt: new Date().toISOString(),
    unmatched: 0,
    ambiguous: 0,
    pendingSubmissions: 0,
  });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: false,
    gmailEmail: null,
    status: 'NOT_CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
  });
  vi.mocked(api.getApplication).mockResolvedValue(base);
  vi.mocked(api.getApplicationEvents).mockResolvedValue(page([]));
  vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
  vi.mocked(api.listApplications).mockResolvedValue(page([]));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('runtime contract validation (real client)', () => {
  const respond = (body: unknown, status = 200) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

  it('sends discovery filters through the normal application API with cancellation', async () => {
    respond(page([]));
    const signal = new AbortController().signal;
    await new ApiClient().listApplications(
      {
        q: 'A & B',
        effectiveStatus: 'UNKNOWN',
        submittedVia: 'AUTOMATION',
        sort: 'applied_desc',
        archive: 'all',
        offset: 20,
      },
      { signal },
    );
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('/api/applications?');
    const params = new URL(String(url), 'http://localhost').searchParams;
    expect(Object.fromEntries(params)).toEqual({
      q: 'A & B',
      effectiveStatus: 'UNKNOWN',
      submittedVia: 'AUTOMATION',
      sort: 'applied_desc',
      archive: 'all',
      offset: '20',
    });
    expect(options).toMatchObject({ signal, method: 'GET' });
  });

  it('accepts a valid null status and rejects a missing required field', async () => {
    respond(makeApplication());
    await expect(new ApiClient().getApplication('app-1')).resolves.toMatchObject({
      effectiveStatus: null,
      statusSource: 'UNKNOWN',
    });
    const missing: Record<string, unknown> = { ...makeApplication() };
    delete missing.userStatusRevision;
    respond(missing);
    await expect(new ApiClient().getApplication('app-1')).rejects.toMatchObject({
      kind: 'contract',
      message: 'The server returned an unexpected response.',
    });
  });

  it('rejects invalid event recording timestamps and missing source keys', async () => {
    respond(page([{ ...makeEvent(), recordedAt: 'not-a-date' }]));
    await expect(new ApiClient().getApplicationEvents('app-1')).rejects.toMatchObject({
      kind: 'contract',
    });
    const noSource: Record<string, unknown> = { ...makeEvent() };
    delete noSource.sourceEmail;
    respond(page([noSource]));
    await expect(new ApiClient().getApplicationEvents('app-1')).rejects.toMatchObject({
      kind: 'contract',
    });
  });

  it('keeps HTTP status and machine-readable code, and marks malformed success as uncertain', async () => {
    respond({ error: { code: 'STATUS_CONFLICT', message: 'Reload' } }, 409);
    const err = await new ApiClient()
      .updateApplicationStatus('app-1', { userStatus: 'OFFER', expectedUserStatusRevision: 0 })
      .catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: 'STATUS_CONFLICT', outcomeUncertain: false });
    respond({ ok: true });
    const malformed = await new ApiClient()
      .updateApplicationStatus('app-1', { userStatus: 'OFFER', expectedUserStatusRevision: 0 })
      .catch((e) => e);
    expect(malformed).toMatchObject({ kind: 'contract', outcomeUncertain: true });
    respond({ error: { code: 'INTERNAL_SERVER_ERROR' } }, 500);
    expect(await new ApiClient().getApplication('app-1').catch((e) => e.outcomeUncertain)).toBe(
      true,
    );
  });
});

describe('cache ordering helpers', () => {
  it('a stale read keeps newer manual state but takes fresh AI state', () => {
    const known = withUser('OFFER', 3);
    const merged = preferNewerManualState(known, withUser(null, 1, { aiStatus: 'REJECTED' }));
    expect(merged).toMatchObject({
      userStatus: 'OFFER',
      userStatusRevision: 3,
      aiStatus: 'REJECTED',
      effectiveStatus: 'OFFER',
      hasStatusConflict: true,
    });
  });
  it('a lower-revision mutation response never replaces a cached higher revision', () => {
    const qc = new QueryClient();
    qc.setQueryData(['application', 'app-1'], withUser('OFFER', 5));
    qc.setQueryData(['applications', { offset: 0, limit: 20 }], page([withUser('OFFER', 5)]));
    applyAcknowledgedApplication(qc, withUser('APPLIED', 3));
    expect(qc.getQueryData<ApplicationResponse>(['application', 'app-1'])!.userStatusRevision).toBe(
      5,
    );
    expect(
      qc.getQueryData<PaginatedResponse<ApplicationResponse>>([
        'applications',
        { offset: 0, limit: 20 },
      ])!.items[0].userStatus,
    ).toBe('OFFER');
  });
});

describe('stale-read guard (R02)', () => {
  it('a detail read that is not cancelled and resolves after an acknowledgement keeps the newer manual state', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['application', 'app-1'], withUser(null, 0));
    const inFlight = deferred<ApplicationResponse>();
    vi.mocked(api.getApplication).mockReturnValueOnce(inFlight.promise);
    const read = applicationQueryOptions(qc, 'app-1').queryFn({
      signal: new AbortController().signal,
    });
    applyAcknowledgedApplication(qc, withUser('OFFER', 1)); // acknowledged while the GET is in flight
    inFlight.resolve(withUser(null, 0, { aiStatus: 'REJECTED' }));
    expect(await read).toMatchObject({
      userStatus: 'OFFER',
      userStatusRevision: 1,
      aiStatus: 'REJECTED',
      effectiveStatus: 'OFFER',
    });
  });

  it('automation review list fetches share the revision guard', async () => {
    vi.mocked(api.listApplications).mockResolvedValue(page([withUser(null, 0)]));
    vi.mocked(api.getActions).mockResolvedValue(page([]));
    vi.mocked(api.getAmbiguousEmails).mockResolvedValue(page([]));
    vi.mocked(api.getUnmatchedEmails).mockResolvedValue(page([]));
    vi.mocked(api.getPendingSubmissions).mockResolvedValue(page([]));
    show('/automation', (qc) => qc.setQueryData(['application', 'app-1'], withUser('OFFER', 5)));
    await waitFor(() => expect(api.listApplications).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        queryClient.getQueryData<PaginatedResponse<ApplicationResponse>>([
          'applications',
          { offset: 0, limit: 20 },
        ])?.items[0],
      ).toMatchObject({ userStatus: 'OFFER', userStatusRevision: 5 }),
    );
  });

  it('treats a PATCH response for another application as uncertain and caches nothing for it', async () => {
    vi.mocked(api.updateApplicationStatus).mockResolvedValue(
      makeApplication({ id: 'app-other', userStatus: 'OFFER', userStatusRevision: 1 }),
    );
    show();
    await choose('OFFER');
    await screen.findByText(/We could not confirm your change\. The status is now/);
    expect(queryClient.getQueryData(['application', 'app-other'])).toBeUndefined();
    expect(api.updateApplicationStatus).toHaveBeenCalledTimes(1);
  });
});

describe('status dropdown', () => {
  it('saves a choice at once and announces it', async () => {
    vi.mocked(api.updateApplicationStatus).mockResolvedValue(withUser('OFFER', 1));
    show();
    await statusBox();
    // The live region is there, empty, before any save, and stays the same node after it.
    const region = liveRegion();
    expect(region).toBeInTheDocument();
    expect(region).toBeEmptyDOMElement();
    await choose('OFFER');
    await waitFor(() => expect(region).toHaveTextContent('Status saved.'));
    expect(liveRegion()).toBe(region);
    expect(api.updateApplicationStatus).toHaveBeenCalledWith('app-1', {
      userStatus: 'OFFER',
      expectedUserStatusRevision: 0,
    });
    expect(screen.getByText(/^Set by you · /)).toBeInTheDocument();
    expect(await statusBox()).toHaveAccessibleName('Status: Offer. Change status');
  });

  it('says in the list that a status change finishes nothing and sends nothing', async () => {
    show();
    fireEvent.click(await statusBox());
    expect(
      await screen.findByText(/does not finish to-dos, ask the AI again or send anything/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: "Use the AI's status (Interview)" }),
    ).toBeInTheDocument();
  });

  it('switches back to the stored AI status with null', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(withUser('OFFER', 2));
    vi.mocked(api.updateApplicationStatus).mockResolvedValue(withUser(null, 3));
    show();
    await choose('AI');
    await screen.findByText('Set by the AI from your mails');
    expect(api.updateApplicationStatus).toHaveBeenCalledWith('app-1', {
      userStatus: null,
      expectedUserStatusRevision: 2,
    });
  });

  it('offers the AI status when the AI disagrees with the user', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(withUser('OFFER', 2));
    vi.mocked(api.updateApplicationStatus).mockResolvedValue(withUser(null, 3));
    show();
    expect(
      await screen.findByText(/^You set Offer\. The AI reads your latest mail as Interview/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "Use the AI's status" }));
    await screen.findByText('Set by the AI from your mails');
    expect(api.updateApplicationStatus).toHaveBeenCalledWith('app-1', {
      userStatus: null,
      expectedUserStatusRevision: 2,
    });
    expect(screen.queryByText(/^You set Offer/)).not.toBeInTheDocument();
  });

  it('sends nothing when the status chosen is the one already set', async () => {
    show();
    await choose('AI'); // the application already follows the AI
    expect(api.updateApplicationStatus).not.toHaveBeenCalled();
  });

  it('blocks the dropdown while saving and never retries by itself', async () => {
    const pending = deferred<ApplicationResponse>();
    vi.mocked(api.updateApplicationStatus).mockReturnValue(pending.promise);
    show();
    await choose('OFFER');
    expect(await screen.findByText('Saving…')).toBeInTheDocument();
    expect(await statusBox()).toBeDisabled();
    await act(async () => pending.reject(new ApiError('bad', 'http', 400, 'VALIDATION_ERROR')));
    await screen.findByText(/The server did not take the change/);
    await waitFor(() => expect(noticeBox(/The server did not take/)).toHaveFocus());
    expect(screen.queryByText('bad')).not.toBeInTheDocument(); // never the raw error
    expect(api.updateApplicationStatus).toHaveBeenCalledTimes(1);
    expect(await statusBox()).toBeEnabled();
  });

  it('never overwrites a change made elsewhere, and saves the next choice on the new revision', async () => {
    vi.mocked(api.updateApplicationStatus).mockRejectedValueOnce(conflict());
    show();
    await statusBox();
    vi.mocked(api.getApplication).mockResolvedValue(withUser('OFFER', 1)); // another tab saved
    await choose('REJECTED');
    await screen.findByText(/changed somewhere else/);
    await waitFor(() => expect(screen.getByText(/It is now Offer\./)).toBeInTheDocument());
    await waitFor(() => expect(noticeBox(/changed somewhere else/)).toHaveFocus());
    expect(api.updateApplicationStatus).toHaveBeenLastCalledWith('app-1', {
      userStatus: 'REJECTED',
      expectedUserStatusRevision: 0,
    });
    vi.mocked(api.updateApplicationStatus).mockResolvedValueOnce(withUser('REJECTED', 2));
    await choose('REJECTED');
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Status saved.'));
    expect(api.updateApplicationStatus).toHaveBeenLastCalledWith('app-1', {
      userStatus: 'REJECTED',
      expectedUserStatusRevision: 1,
    });
    expect(api.updateApplicationStatus).toHaveBeenCalledTimes(2);
  });

  it('uses the revision the page shows after another device saved', async () => {
    show();
    await statusBox();
    vi.mocked(api.getApplication).mockResolvedValue(withUser('OFFER', 1)); // second device saved
    await refetchDetail();
    await screen.findByText(/^Set by you · /);
    vi.mocked(api.updateApplicationStatus).mockResolvedValue(withUser('REJECTED', 2));
    await choose('REJECTED');
    expect(api.updateApplicationStatus).toHaveBeenCalledWith('app-1', {
      userStatus: 'REJECTED',
      expectedUserStatusRevision: 1,
    });
  });

  it('cancels a pre-save read so it cannot repaint older state after acknowledgement', async () => {
    show();
    await screen.findByText('Set by the AI from your mails');
    const stale = deferred<ApplicationResponse>();
    vi.mocked(api.getApplication).mockReturnValueOnce(stale.promise); // started before save
    await refetchDetail();
    vi.mocked(api.getApplication).mockResolvedValue(withUser('OFFER', 1));
    vi.mocked(api.updateApplicationStatus).mockResolvedValue(withUser('OFFER', 1));
    await choose('OFFER');
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Status saved.'));
    // Cancellation reached the read's fetch signal before the PATCH was sent.
    expect(vi.mocked(api.getApplication).mock.calls[1][1]?.signal?.aborted).toBe(true);
    await act(async () => stale.resolve(withUser(null, 0)));
    expect(screen.getByText(/^Set by you · /)).toBeInTheDocument();
    expect(await statusBox()).toHaveAccessibleName('Status: Offer. Change status');
  });

  it('ignores a read restarted during the mutation that returns older manual state', async () => {
    const patch = deferred<ApplicationResponse>();
    vi.mocked(api.updateApplicationStatus).mockReturnValue(patch.promise);
    show();
    await choose('OFFER');
    await screen.findByText('Saving…');
    const restarted = deferred<ApplicationResponse>();
    vi.mocked(api.getApplication).mockReturnValueOnce(restarted.promise);
    await refetchDetail(); // background refresh during the PATCH
    await act(async () => patch.resolve(withUser('OFFER', 1)));
    await waitFor(() => expect(liveRegion()).toHaveTextContent('Status saved.'));
    await act(async () => restarted.resolve(withUser(null, 0)));
    vi.mocked(api.getApplication).mockResolvedValue(withUser(null, 0, { aiStatus: 'REJECTED' })); // late stale replica
    await refetchDetail();
    await waitFor(() =>
      expect(screen.getByText(/The AI reads your latest mail as Rejected/)).toBeInTheDocument(),
    );
    expect(await statusBox()).toHaveAccessibleName('Status: Offer. Change status');
  });

  it.each([
    ['timeout', new ApiError('timed out', 'timeout')],
    ['lost response', new ApiError('network', 'network')],
    ['5xx', new ApiError('boom', 'http', 500, 'INTERNAL_SERVER_ERROR')],
    ['invalid 2xx', new ApiError('unexpected', 'contract', 200)],
  ])(
    'reconciles an uncertain save (%s) by reading, without resubmitting',
    async (_label, error) => {
      vi.mocked(api.updateApplicationStatus).mockRejectedValue(error);
      show();
      await statusBox();
      vi.mocked(api.getApplication).mockResolvedValue(withUser('OFFER', 1)); // the write had committed
      await choose('OFFER');
      await screen.findByText(/We could not confirm your change\. The status is now Offer\./);
      await waitFor(() => expect(noticeBox(/We could not confirm/)).toHaveFocus());
      expect(api.updateApplicationStatus).toHaveBeenCalledTimes(1);
      // The page shows what is saved now; choosing it again sends nothing.
      await choose('OFFER');
      expect(api.updateApplicationStatus).toHaveBeenCalledTimes(1);
    },
  );

  it('blocks the dropdown when the check after an uncertain save fails, until it is checked again', async () => {
    vi.mocked(api.updateApplicationStatus).mockRejectedValue(new ApiError('network', 'network'));
    show();
    await statusBox();
    vi.mocked(api.getApplication).mockRejectedValue(new ApiError('network', 'network'));
    await choose('OFFER');
    await screen.findByText(/the status could not be loaded/);
    await waitFor(() => expect(noticeBox(/the status could not be loaded/)).toHaveFocus());
    expect(await statusBox()).toBeDisabled();
    vi.mocked(api.getApplication).mockResolvedValue(withUser(null, 0));
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await screen.findByText(/We could not confirm your change\. The status is now/);
    // The button is gone, so focus is on the notice, not lost on the page.
    await waitFor(() => expect(noticeBox(/We could not confirm/)).toHaveFocus());
    expect(await statusBox()).toBeEnabled();
    expect(api.updateApplicationStatus).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the notice when the application is gone', async () => {
    vi.mocked(api.updateApplicationStatus).mockRejectedValue(
      new ApiError('gone', 'http', 404, 'NOT_FOUND'),
    );
    show();
    await choose('OFFER');
    await screen.findByText('This application is no longer available.');
    await waitFor(() =>
      expect(noticeBox('This application is no longer available.')).toHaveFocus(),
    );
    expect(await statusBox()).toBeDisabled();
  });

  it('keeps focus where it is when only a background read changes the status', async () => {
    show();
    const box = await statusBox();
    box.focus();
    vi.mocked(api.getApplication).mockResolvedValue(withUser('OFFER', 1));
    await refetchDetail();
    await screen.findByText(/^Set by you · /);
    expect(await statusBox()).toHaveFocus();
  });

  it('keeps the dropdown blocked in the unknown state even after a later read succeeds', async () => {
    vi.mocked(api.updateApplicationStatus).mockRejectedValue(new ApiError('network', 'network'));
    show();
    await statusBox();
    vi.mocked(api.getApplication).mockRejectedValue(new ApiError('network', 'network'));
    await choose('OFFER');
    await screen.findByText(/the status could not be loaded/);
    vi.mocked(api.getApplication).mockResolvedValue(withUser('OFFER', 1));
    await refetchDetail(); // background read succeeds: the application section is healthy again
    await waitFor(() => expect(screen.queryByText(/may be out of date/)).not.toBeInTheDocument());
    expect(screen.getByText(/the status could not be loaded/)).toBeInTheDocument();
    expect(await statusBox()).toBeDisabled(); // blocked by the unknown outcome itself
    expect(api.updateApplicationStatus).toHaveBeenCalledTimes(1);
  });

  it('applies a pending save to its original application after navigation', async () => {
    const patch = deferred<ApplicationResponse>();
    vi.mocked(api.updateApplicationStatus).mockReturnValue(patch.promise);
    vi.mocked(api.getApplication).mockImplementation(async (id) =>
      id === 'app-2' ? makeApplication({ id: 'app-2', companyName: 'Other Co' }) : base,
    );
    const router = show();
    await choose('OFFER');
    await act(() => router.navigate({ to: '/applications/$id', params: { id: 'app-2' } }));
    await screen.findByRole('heading', { name: 'Other Co' });
    await act(async () => patch.resolve(withUser('OFFER', 1)));
    await waitFor(() =>
      expect(
        queryClient.getQueryData<ApplicationResponse>(['application', 'app-1'])?.userStatus,
      ).toBe('OFFER'),
    );
    expect(
      queryClient.getQueryData<ApplicationResponse>(['application', 'app-2'])?.userStatus,
    ).toBeNull();
    expect(screen.getByText('No status yet')).toBeInTheDocument();
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument(); // the control is per application
  });

  it('closes the list on Escape and gives focus back to the dropdown', async () => {
    show();
    const box = await statusBox();
    fireEvent.click(box);
    const list = await screen.findByRole('listbox');
    fireEvent.keyDown(list, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    await waitFor(() => expect(box).toHaveFocus());
  });

  it('shows unknown legacy confirmation time', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(
      makeApplication({ userStatus: 'OFFER', userStatusSetAt: null }),
    );
    show();
    expect(await screen.findByText('Set by you · date unknown')).toBeInTheDocument();
  });
});

describe('section isolation and evidence', () => {
  it('blocks editing when the application contract is invalid', async () => {
    vi.mocked(api.getApplication).mockRejectedValue(
      new ApiError('The server returned an unexpected response.', 'contract', 200),
    );
    show();
    expect(await screen.findByText(/Could not load this application/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Change status/ })).not.toBeInTheDocument();
  });

  it('marks retained data stale and disables editing after a refresh failure', async () => {
    show();
    await screen.findByRole('heading', { name: 'Acme Corp' });
    vi.mocked(api.getApplication).mockRejectedValue(new ApiError('timed out', 'timeout'));
    await refetchDetail();
    expect(await screen.findByText(/you see an earlier one/)).toBeInTheDocument();
    expect(await statusBox()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add follow-up' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('isolates a malformed history response and lets the user retry it', async () => {
    vi.mocked(api.getApplicationEvents).mockRejectedValueOnce(
      new ApiError('The server returned an unexpected response.', 'contract', 200),
    );
    show();
    const history = await screen.findByRole('region', { name: 'History' });
    expect(await within(history).findByText(/Could not load the history/)).toBeInTheDocument();
    expect(await statusBox()).toBeEnabled();
    fireEvent.click(within(history).getByRole('button', { name: 'Try again' }));
    expect(await within(history).findByText(/^Nothing yet\./)).toBeInTheDocument();
  });

  it('isolates a next-steps failure and lets the user retry it', async () => {
    vi.mocked(api.getApplicationActions).mockRejectedValueOnce(
      new ApiError('timed out', 'timeout'),
    );
    show();
    const steps = await screen.findByRole('region', { name: 'Next steps' });
    expect(await within(steps).findByText(/Could not load next steps/)).toBeInTheDocument();
    expect(await statusBox()).toBeEnabled();
    expect(await screen.findByText(/^Nothing yet\./)).toBeInTheDocument();
    fireEvent.click(within(steps).getByRole('button', { name: 'Try again' }));
    expect(await within(steps).findByText('Nothing to do now.')).toBeInTheDocument();
  });

  it('labels recording time and the AI reading, and renders metadata as text', async () => {
    vi.mocked(api.getApplicationEvents).mockResolvedValue(
      page([
        makeEvent({
          id: 'e1',
          oldState: 'INTERVIEW',
          newState: 'INTERVIEW',
          description: 'Interview mentioned',
          createdAt: '2026-09-03T10:00:00.000Z',
          sourceEmail: {
            id: 'm1',
            subject: '<img src=x onerror=alert(1)>',
            sender: 'hr@example.test',
            receivedAt: '2026-09-01T08:00:00.000Z',
          },
        }),
        makeEvent({
          id: 'e2',
          type: 'NOTE_ADDED',
          oldState: null,
          newState: null,
          description: null,
        }),
      ]),
    );
    show();
    expect(await screen.findByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('The AI kept the status at Interview')).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    const history = screen.getByRole('region', { name: 'History' });
    expect(within(history).getAllByTitle(/^Recorded /)).toHaveLength(2);
    expect(screen.getByText('Note added')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show the AI note' }));
    expect(screen.getByText('Interview mentioned')).toBeInTheDocument();
    expect(screen.getByText(/the AI's reading, not the mail's own words/)).toBeInTheDocument();
  });
});

describe('creation outcome recovery', () => {
  const fill = () =>
    fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Linear' } });
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  it('keeps the draft, reconciles owned reads and never replays the POST', async () => {
    vi.mocked(api.createApplication).mockRejectedValue(new ApiError('unexpected', 'contract', 201));
    show('/applications');
    fireEvent.click(await screen.findByRole('button', { name: 'Add application' }));
    fill();
    vi.mocked(api.listApplications).mockResolvedValue(
      page([makeApplication({ companyName: 'Linear' })]),
    ); // same company: not proof
    submit();
    expect(await screen.findByText('Creation outcome unknown')).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Create anyway' });
    expect(screen.getByLabelText('Company')).toHaveValue('Linear');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    submit();
    expect(api.createApplication).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/does not prove which request created it/)).toBeInTheDocument();
    vi.mocked(api.createApplication).mockResolvedValue(
      makeApplication({ id: 'new', companyName: 'Linear' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create anyway' }));
    await waitFor(() => expect(api.createApplication).toHaveBeenCalledTimes(2));
  });

  it('refreshes the visible active-list cache during uncertain creation recovery', async () => {
    vi.mocked(api.createApplication).mockRejectedValue(new ApiError('lost', 'network'));
    show('/applications');
    fireEvent.click(await screen.findByRole('button', { name: 'Add application' }));
    fill();
    vi.mocked(api.listApplications).mockResolvedValue(
      page([makeApplication({ companyName: 'Recovered company' })]),
    );
    submit();
    await screen.findByRole('button', { name: 'Create anyway' });
    fireEvent.click(screen.getByRole('button', { name: 'Review applications' }));
    expect(await screen.findByText('Recovered company')).toBeVisible();
    expect(api.createApplication).toHaveBeenCalledTimes(1);
    expect(api.listApplications).toHaveBeenLastCalledWith(
      { offset: 0, limit: 20, archive: 'active' },
      expect.anything(),
    );
  });

  it('stays blocked and offers a read retry when reconciliation fails', async () => {
    vi.mocked(api.createApplication).mockRejectedValue(new ApiError('timed out', 'timeout'));
    show('/applications');
    fireEvent.click(await screen.findByRole('button', { name: 'Add application' }));
    fill();
    vi.mocked(api.listApplications).mockRejectedValue(new ApiError('network', 'network'));
    submit();
    expect(await screen.findByText('Your applications could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Create anyway' })).not.toBeInTheDocument();
    vi.mocked(api.listApplications).mockResolvedValue(page([]));
    fireEvent.click(screen.getByRole('button', { name: 'Retry refresh' }));
    await screen.findByRole('button', { name: 'Create anyway' }); // an empty first page is not proof of failure
    expect(api.createApplication).toHaveBeenCalledTimes(1);
  });

  it('treats a definitive validation rejection as an ordinary editable error', async () => {
    vi.mocked(api.createApplication).mockRejectedValue(
      new ApiError('Invalid request data', 'http', 400, 'VALIDATION_ERROR'),
    );
    show('/applications');
    fireEvent.click(await screen.findByRole('button', { name: 'Add application' }));
    fill();
    submit();
    expect(
      await screen.findByText(/Error creating application: Invalid request data/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Creation outcome unknown')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
});

describe('filtered application cache membership (S9)', () => {
  it('removes acknowledged status changes from UNKNOWN source/sort pages and blocks late resurrection', async () => {
    const qc = new QueryClient();
    const unknown = makeApplication({ submittedVia: 'AUTOMATION' });
    const params = {
      offset: 0,
      limit: 20,
      effectiveStatus: 'UNKNOWN',
      submittedVia: 'AUTOMATION',
      sort: 'applied_desc',
    } as const;
    const key = ['applications', params];
    qc.setQueryData(key, page([unknown]));
    const updated = makeApplication({
      submittedVia: 'AUTOMATION',
      userStatus: 'OFFER',
      userStatusRevision: 1,
    });
    applyAcknowledgedApplication(qc, updated);
    expect(qc.getQueryData(key)).toMatchObject({ items: [] });
    vi.mocked(api.listApplications)
      .mockResolvedValueOnce(page([unknown]))
      .mockResolvedValueOnce(page([]));
    expect(await fetchApplicationsPage(qc, params)).toMatchObject({ items: [] });
    expect(api.listApplications).toHaveBeenCalledTimes(2);
    qc.clear();
  });
  it('removes a newly nonmatching row immediately without inventing membership on another page', () => {
    const qc = new QueryClient();
    const interview = ['applications', { offset: 20, limit: 20, effectiveStatus: 'INTERVIEW' }];
    const rejected = ['applications', { offset: 0, limit: 20, effectiveStatus: 'REJECTED' }];
    qc.setQueryData(interview, page([base]));
    qc.setQueryData(rejected, page([]));
    applyAcknowledgedApplication(qc, withUser('REJECTED', 1));
    expect(qc.getQueryData(interview)).toMatchObject({ items: [] });
    expect(qc.getQueryState(interview)?.isInvalidated).toBe(true);
    expect(qc.getQueryData(rejected)).toMatchObject({ items: [] });
    qc.clear();
  });
  it('does not restore an older filter membership when an acknowledgement arrives out of order', () => {
    const qc = new QueryClient();
    const key = ['applications', { offset: 0, limit: 20, effectiveStatus: 'REJECTED' }];
    qc.setQueryData(key, page([withUser('REJECTED', 1)]));
    qc.setQueryData(['application', base.id], withUser('OFFER', 3));
    applyAcknowledgedApplication(qc, withUser('REJECTED', 2));
    expect(qc.getQueryData(key)).toMatchObject({ items: [] });
    expect(qc.getQueryData(['application', base.id])).toMatchObject({ userStatusRevision: 3 });
    qc.clear();
  });
  it('rereads a late page when revision merging changes filtered membership', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['application', base.id], withUser('REJECTED', 1));
    vi.mocked(api.listApplications)
      .mockResolvedValueOnce(page([base]))
      .mockResolvedValueOnce(page([]));
    expect(
      await fetchApplicationsPage(qc, { offset: 0, limit: 20, effectiveStatus: 'INTERVIEW' }),
    ).toMatchObject({ items: [] });
    expect(api.listApplications).toHaveBeenCalledTimes(2);
    qc.clear();
  });
  it('keeps a failed reread recoverable instead of returning a known nonmatching row', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['application', base.id], withUser('REJECTED', 1));
    vi.mocked(api.listApplications)
      .mockResolvedValueOnce(page([base]))
      .mockRejectedValueOnce(new Error('Unavailable'));
    await expect(
      fetchApplicationsPage(qc, { offset: 0, limit: 20, effectiveStatus: 'INTERVIEW' }),
    ).rejects.toThrow('Unavailable');
    expect(api.listApplications).toHaveBeenCalledTimes(2);
    qc.clear();
  });
  it('bounds inconsistent rereads and handles clearing an override', async () => {
    const qc = new QueryClient();
    const rejected = withUser('REJECTED', 1);
    qc.setQueryData(['application', base.id], withUser(null, 2));
    vi.mocked(api.listApplications).mockResolvedValue(page([rejected]));
    await expect(
      fetchApplicationsPage(qc, { offset: 0, limit: 20, effectiveStatus: 'REJECTED' }),
    ).rejects.toMatchObject({ kind: 'contract' });
    expect(api.listApplications).toHaveBeenCalledTimes(2);
    qc.clear();
  });
});
