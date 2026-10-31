// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('../components/ui/toast', () => ({ showToast: vi.fn() }));
vi.mock('../lib/offlineCopy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/offlineCopy')>()),
  forgetOfflineCopies: vi.fn(async () => undefined),
}));

import { ApiError, api } from '../api/client';
import { useMarkSeenOnOpen } from '../api/conversations';
import { OfflineLine, OfflinePage } from '../components/layout/OfflinePage';
import { logOutAndLeave } from '../components/layout/AccountMenu';
import { createQueryClient } from '../components/queryClient';
import { showToast } from '../components/ui/toast';
import type { Conversation } from '../contracts/conversation';
import { replyProblem } from '../lib/mailReply';
import { phaseAfterError } from '../lib/statusChoice';
import {
  OFFLINE_CHANGE,
  OFFLINE_REPLY,
  isOfflineError,
  pageHasNoCopy,
  shownSince,
  shownSinceText,
} from '../lib/offline';
import { forgetOfflineCopies } from '../lib/offlineCopy';

const NOW = new Date(2026, 9, 30, 10, 42);
const backend = vi.fn<typeof fetch>(async () => new Response('{}'));

beforeEach(() => {
  vi.stubGlobal('fetch', backend);
  backend.mockClear();
  vi.mocked(showToast).mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
});

const query = (key: string[], data: unknown, dataUpdatedAt = 0) => ({
  queryKey: key,
  state: { data, dataUpdatedAt } as never,
});

describe('what a page shows offline', () => {
  it('has no copy when one of its own parts has no data; the menu and sync parts do not count', () => {
    const page = query(['conversations', 'list'], { items: [] }, 1);
    expect(pageHasNoCopy([page, query(['aiReading'], undefined)])).toBe(false);
    expect(pageHasNoCopy([page, query(['auth', 'currentUser'], undefined)])).toBe(false);
    expect(pageHasNoCopy([page, query(['application', 'a7'], undefined)])).toBe(true);
  });

  it('dates the page by its oldest data, leaving out the parts around it', () => {
    expect(
      shownSince([
        query(['application', 'a7'], {}, 2000),
        query(['application-events', 'a7'], {}, 1000),
        query(['aiReading'], {}, 500),
      ]),
    ).toBe(1000);
    expect(shownSince([query(['aiReading'], {}, 500)])).toBeNull();
  });

  it('says when, in the words of the mail list', () => {
    vi.useFakeTimers({ now: NOW });
    expect(shownSinceText(NOW.getTime())).toBe('Showing what was here at 10:42 AM.');
    expect(shownSinceText(NOW.getTime() - 24 * 3600_000)).toBe(
      'Showing what was here yesterday at 10:42 AM.',
    );
    expect(shownSinceText(new Date(2026, 9, 21, 9, 5).getTime())).toBe(
      'Showing what was here on Oct 21 at 9:05 AM.',
    );
  });
});

describe('a change pressed offline', () => {
  it('is refused before anything is sent, and says nothing was changed', async () => {
    onlineManager.setOnline(false);
    const error = await api.post('/api/conversations/k/seen', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe(OFFLINE_CHANGE);
    expect((error as ApiError).outcomeUncertain).toBe(false);
    expect(isOfflineError(error)).toBe(true);
    expect(backend).not.toHaveBeenCalled();
  });

  it('runs at once, shows the offline toast, and is never sent later', async () => {
    const client = createQueryClient();
    onlineManager.setOnline(false);
    const send = vi.fn(() => api.post('/api/applications/a7/status', { status: 'OFFER' }));
    const mutation = client.getMutationCache().build(client, { mutationFn: send });
    await expect(mutation.execute(undefined)).rejects.toThrow(OFFLINE_CHANGE);
    expect(showToast).toHaveBeenCalledWith(OFFLINE_CHANGE, { offline: true });

    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    expect(send).toHaveBeenCalledTimes(1);
    expect(backend).not.toHaveBeenCalled();
  });

  it('names its own words when it has them, and stays quiet on other errors', async () => {
    const client = createQueryClient();
    onlineManager.setOnline(false);
    const reply = client.getMutationCache().build(client, {
      mutationFn: () => api.post('/api/mailbox/threads/t/replies', {}),
      meta: { offlineMessage: OFFLINE_REPLY },
    });
    await reply.execute(undefined).catch(() => undefined);
    expect(showToast).toHaveBeenLastCalledWith(OFFLINE_REPLY, { offline: true });

    onlineManager.setOnline(true);
    vi.mocked(showToast).mockClear();
    const failing = client.getMutationCache().build(client, {
      mutationFn: () => Promise.reject(new ApiError('Busy', 'http', 503)),
    });
    await failing.execute(undefined).catch(() => undefined);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('leaves a status change without a "not sure it was saved" notice: the toast says it', () => {
    expect(phaseAfterError(new ApiError(OFFLINE_CHANGE, 'offline'), 'OFFER')).toEqual({
      kind: 'idle',
    });
  });

  it('leaves the reply box without a second message: the toast says it', () => {
    expect(replyProblem(new ApiError(OFFLINE_CHANGE, 'offline'))).toBeNull();
    expect(replyProblem(new ApiError('Network error.', 'network'))).toEqual({
      kind: 'unconfirmed',
    });
  });
});

describe('reading and signing out offline', () => {
  function wrap(node: ReactNode, client = new QueryClient()) {
    return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  }

  it('does not mark a mail as seen while offline', async () => {
    onlineManager.setOnline(false);
    function Open() {
      useMarkSeenOnOpen({ key: 'k1', isNew: true } as Conversation);
      return null;
    }
    wrap(<Open />);
    await act(async () => undefined);
    expect(backend).not.toHaveBeenCalled();
  });

  it('keeps the user signed in offline, and wipes the copies when signing out online', async () => {
    onlineManager.setOnline(false);
    await logOutAndLeave();
    expect(showToast).toHaveBeenCalledWith(OFFLINE_CHANGE, { offline: true });
    expect(forgetOfflineCopies).not.toHaveBeenCalled();
    expect(backend).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
    const leave = vi.spyOn(window, 'location', 'get').mockReturnValue({ href: '' } as Location);
    await logOutAndLeave();
    expect(forgetOfflineCopies).toHaveBeenCalled();
    expect(backend).toHaveBeenCalledWith('/api/auth/logout', expect.anything());
    leave.mockRestore();
  });
});

describe('the offline line and a page with no copy', () => {
  function Page({ id }: { id: string }) {
    const { data } = useQuery({
      queryKey: ['application', id],
      queryFn: () => ({ company: 'New' }),
    });
    return <p>Application {data ? data.company : 'loading'}</p>;
  }
  function Shell({ children, client }: { children: ReactNode; client: QueryClient }) {
    return (
      <QueryClientProvider client={client}>
        <OfflineLine />
        <OfflinePage>{children}</OfflinePage>
      </QueryClientProvider>
    );
  }

  it('shows the page with its copy and since when', () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const client = new QueryClient();
    client.setQueryData(['application', 'a7'], { company: 'Acme' }, { updatedAt: NOW.getTime() });
    onlineManager.setOnline(false);
    render(
      <Shell client={client}>
        <Page id="a7" />
      </Shell>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      "You're offline. Showing what was here at 10:42 AM.",
    );
    expect(screen.getByText('Application Acme')).toBeVisible();
  });

  it('says there is no copy instead of loading forever, and shows the page once back online', async () => {
    const client = new QueryClient();
    onlineManager.setOnline(false);
    render(
      <Shell client={client}>
        <Page id="a8" />
      </Shell>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/^You're offline\.$/);
    expect(screen.getByText('No copy of this page yet')).toBeInTheDocument();
    expect(screen.getByText('Application loading')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await act(async () => onlineManager.setOnline(true));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(await screen.findByText('Application New')).toBeVisible();
  });

  it('shows nothing extra online', () => {
    render(
      <Shell client={new QueryClient()}>
        <Page id="a9" />
      </Shell>,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('No copy of this page yet')).not.toBeInTheDocument();
  });
});

describe('a change from a page', () => {
  it('fails at once offline instead of waiting to be sent', async () => {
    const client = createQueryClient();
    onlineManager.setOnline(false);
    function Button() {
      const change = useMutation({ mutationFn: () => api.post('/api/x', {}) });
      return <button onClick={() => change.mutate()}>Change {change.status}</button>;
    }
    render(
      <QueryClientProvider client={client}>
        <Button />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('Change error')).toBeInTheDocument();
    expect(backend).not.toHaveBeenCalled();
  });
});
