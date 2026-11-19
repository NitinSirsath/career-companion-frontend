// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { ConversationDetail } from '../contracts/conversation';
import type { ReanalysisPreview, ReanalysisRun } from '../contracts/reanalysis';
import {
  makeApplication,
  makeConversation,
  makeConversationMail,
  makeMailMessage,
} from './fixtures';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    getGmailStatus: vi.fn(),
    getAISettings: vi.fn(),
    listApplications: vi.fn(),
    getApplication: vi.fn(),
    getApplicationEvents: vi.fn(),
    getApplicationActions: vi.fn(),
  },
}));
vi.mock('../components/ui/toast', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../components/ui/toast')>()),
  showToast: vi.fn(),
}));

import { showToast } from '../components/ui/toast';
import { routeTree } from '../routeTree.gen';

const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });
const PATH = '/api/conversations/thread-1/reanalyze';
const APP_PATH = '/api/applications/app-1/reanalyze';
const PHONE_WIDTH = 375;

const PREVIEW: ReanalysisPreview = {
  conversations: 1,
  mails: 1,
  replies: 1,
  maxReads: 3,
  readsLeft: 238,
  reserve: 20,
  reader: { provider: 'gemini', model: 'gemini-3.8-flash' },
  leftOut: 0,
  unfinishedMails: 0,
  blocked: null,
  retryAt: null,
};
const run = (overrides: Partial<ReanalysisRun> = {}): ReanalysisRun => ({
  id: '0b9f9a57-6c3a-4d1e-8d2f-2a4e6f1b7c90',
  state: 'QUEUED',
  stopReason: null,
  conversations: 1,
  saved: 0,
  changed: 0,
  gone: 0,
  createdAt: new Date().toISOString(),
  finishedAt: null,
  ...overrides,
});

let detail: ConversationDetail;
let current: ReanalysisRun | null;
let preview: ReanalysisPreview;
let desktopWidth: number;
const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const setWidth = (width: number) =>
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });

function show(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { user: { id: 'u', email: 'u@test.local', name: 'U' } },
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  desktopWidth = window.innerWidth;
  detail = {
    conversation: makeConversation(),
    mails: [makeConversationMail()],
    sentAt: [],
    replyChoices: [],
  };
  current = null;
  preview = PREVIEW;
  get.mockImplementation(async (path: string) => {
    if (path === PATH || path === APP_PATH) return { run: current, preview: null };
    if (path === `${PATH}?preview=1` || path === `${APP_PATH}?preview=1`)
      return { run: current, preview };
    if (path.startsWith('/api/conversations?')) return page([detail.conversation]);
    if (path.startsWith('/api/conversations/')) return detail;
    if (path.startsWith('/api/mailbox/threads/'))
      return {
        threadId: 'thread-1',
        subject: detail.conversation.subject,
        messages: [makeMailMessage()],
        replyTo: 'Priya Nair <priya.nair@northwind.example>',
      };
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  post.mockImplementation(async (path: string) => {
    if (path === PATH || path === APP_PATH) {
      current = run();
      return current;
    }
    return { seen: true };
  });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'me@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
    canSend: true,
  });
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
});
afterEach(() => {
  cleanup();
  setWidth(desktopWidth);
});

describe('Reanalyze on the mail page (owner, 19 Nov 2026)', () => {
  it('starts from the conversation menu after a confirm that shows what it reads and its cost', async () => {
    show('/mails/thread-1');
    fireEvent.click(await screen.findByRole('button', { name: 'More for this conversation' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reanalyze…' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      dialog.getByRole('heading', { name: 'Reanalyze this conversation?' }),
    ).toBeInTheDocument();
    expect(await dialog.findByText(/reads its 1 mail and your 1 reply again/)).toBeInTheDocument();
    expect(dialog.getByText(/up to 3 AI reads · 238 left today/)).toBeInTheDocument();
    expect(dialog.getByText(/What you changed yourself stays as it is/)).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Reanalyze' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(PATH, {}));
    // The Next step shows the AI's grey reading line, and the menu item is off.
    expect(await screen.findByText('Reanalyzing')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More for this conversation' }));
    expect(await screen.findByRole('menuitem', { name: 'Reanalyzing…' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('says when it saved, and how much changed', { timeout: 15_000 }, async () => {
    current = run({ state: 'RUNNING' });
    show('/mails/thread-1');
    expect(await screen.findByText('Reanalyzing')).toBeInTheDocument();
    current = run({ state: 'SAVED', saved: 1, changed: 2, finishedAt: new Date().toISOString() });
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Reanalyzed. 2 things changed.'), {
      timeout: 8000,
    });
    expect(screen.queryByText('Reanalyzing')).not.toBeInTheDocument();
  });

  it('shows why a run stopped, under the step, and that nothing changed', async () => {
    current = run({
      state: 'STOPPED',
      stopReason: 'GMAIL_FAILED',
      finishedAt: new Date().toISOString(),
    });
    show('/mails/thread-1');
    expect(
      await screen.findByText('Not reanalyzed: Gmail did not answer. Try again. Nothing changed.'),
    ).toBeInTheDocument();
  });

  it('says why it cannot start now, and keeps Reanalyze off', async () => {
    preview = { ...PREVIEW, blocked: 'REANALYZED_RECENTLY' };
    show('/mails/thread-1');
    fireEvent.click(await screen.findByRole('button', { name: 'More for this conversation' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reanalyze…' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      await dialog.findByText('This was reanalyzed a few minutes ago. Try again after 10 minutes.'),
    ).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Reanalyze' })).toBeDisabled();
  });

  it('is not offered for an archived application, nor while the AI is not set up', async () => {
    const application = {
      id: '5d0c3b7e-2f4a-4c1d-9e8b-1a2b3c4d5e6f',
      companyName: 'Northwind',
      jobTitle: 'Frontend Engineer',
      effectiveStatus: 'INTERVIEW' as const,
      archived: true,
      decline: null,
      closedAfterDeclineAt: null,
    };
    detail = { ...detail, conversation: { ...detail.conversation, application } };
    show('/mails/thread-1');
    fireEvent.click(await screen.findByRole('button', { name: 'More for this conversation' }));
    await screen.findByRole('menuitem', { name: 'Delete from NorthList…' });
    expect(screen.queryByRole('menuitem', { name: 'Reanalyze…' })).not.toBeInTheDocument();
    cleanup();

    detail = { ...detail, conversation: makeConversation() };
    vi.mocked(api.getAISettings).mockResolvedValue({
      access: { state: 'NOT_SET_UP' },
      models: null,
      provider: null,
    } as never);
    show('/mails/thread-1');
    fireEvent.click(await screen.findByRole('button', { name: 'More for this conversation' }));
    await screen.findByRole('menuitem', { name: 'Delete from NorthList…' });
    expect(screen.queryByRole('menuitem', { name: 'Reanalyze…' })).not.toBeInTheDocument();
  });

  it('no longer offers "Read my reply again" on the step', async () => {
    const request = {
      ...detail.conversation.request!,
      repliedAt: '2026-10-11T08:45:00.000Z',
      replyRead: 'NOT_ANSWERED' as const,
    };
    detail = { ...detail, conversation: { ...detail.conversation, request } };
    show('/mails/thread-1');
    await screen.findByRole('button', { name: 'More for this conversation' });
    expect(screen.queryByText('Read my reply again')).not.toBeInTheDocument();
    for (const button of screen.queryAllByRole('button', { name: /^More for / })) {
      fireEvent.click(button);
      expect(screen.queryByRole('menuitem', { name: 'Read my reply again' })).toBeNull();
    }
  });
});

describe('Reanalyze on phones', () => {
  it('opens a sheet from the mail tools, and its line takes the place of the AI read', async () => {
    setWidth(PHONE_WIDTH);
    show('/mails/thread-1');
    fireEvent.click(await screen.findByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reanalyze…' }));
    const sheet = within(await screen.findByRole('dialog'));
    expect(await sheet.findByText(/up to 3 AI reads · 238 left today/)).toBeInTheDocument();
    fireEvent.click(sheet.getByRole('button', { name: 'Reanalyze' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(PATH, {}));
    expect(await screen.findByText('Reanalyzing')).toBeInTheDocument();
    expect(screen.queryByText(/^AI read:/)).not.toBeInTheDocument();
  });
});

describe('Reanalyze on the application page', () => {
  beforeEach(() => {
    vi.mocked(api.getApplication).mockResolvedValue(
      makeApplication({ id: 'app-1', companyName: 'Northwind' }),
    );
    vi.mocked(api.getApplicationEvents).mockResolvedValue(page([]));
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
  });

  it('reads its conversations again, and the header says it is reading them', async () => {
    show('/applications/app-1');
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reanalyze…' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(
      await dialog.findByRole('heading', { name: 'Reanalyze 1 conversation?' }),
    ).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Reanalyze' }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(APP_PATH, {}));
    expect(await screen.findByText('Reanalyzing 1 conversation')).toBeInTheDocument();
  });

  it('is not offered for an archived application', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(
      makeApplication({ id: 'app-1', archivedAt: '2026-11-01T10:00:00.000Z' }),
    );
    show('/applications/app-1');
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    await screen.findByRole('menuitem', { name: /^Delete application/ });
    expect(screen.queryByRole('menuitem', { name: 'Reanalyze…' })).not.toBeInTheDocument();
  });
});
