// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { BlockedSender } from '../contracts/blockedSender';
import type { ConversationDetail } from '../contracts/conversation';
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
    delete: vi.fn(),
    getGmailStatus: vi.fn(),
    getAISettings: vi.fn(),
    getApplication: vi.fn(),
    getApplicationEvents: vi.fn(),
    getApplicationActions: vi.fn(),
    listApplications: vi.fn(),
  },
}));

import { routeTree } from '../routeTree.gen';
import { ToastProvider } from '../components/ui/toast';

const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });
const LINKEDIN = 'Andy Chatha via LinkedIn <messaging-digest-noreply@linkedin.com>';
let detail: ConversationDetail;
let blocked: BlockedSender[];
const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const del = vi.mocked(api.delete);

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
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return router;
}

const block = (overrides: Partial<BlockedSender> = {}): BlockedSender => ({
  id: '22222222-2222-4222-8222-222222222222',
  domain: 'northwind.example',
  source: 'MENU',
  createdAt: '2026-10-26T06:00:00.000Z',
  ...overrides,
});

const openMenu = async () =>
  fireEvent.click(
    await screen.findByRole('button', { name: 'More for this conversation' }, { timeout: 3000 }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  blocked = [];
  detail = {
    conversation: makeConversation({ mailCount: 2 }),
    mails: [makeConversationMail()],
    sentAt: [],
    replyChoices: [],
  };
  get.mockImplementation(async (path: string) => {
    if (path === '/api/blocked-senders') return { items: blocked };
    if (path.startsWith('/api/conversations?')) return page([detail.conversation]);
    if (path.startsWith('/api/conversations/')) return detail;
    if (path.startsWith('/api/mailbox/threads/'))
      return {
        threadId: 'thread-1',
        subject: detail.conversation.subject,
        messages: [makeMailMessage()],
        replyTo: detail.conversation.sender,
      };
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  post.mockResolvedValue({ seen: true });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'me@example.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
    canSend: true,
  });
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
  vi.mocked(api.listApplications).mockResolvedValue(page([]));
});
afterEach(cleanup);

describe("a mail's menu", () => {
  it('blocks the company of a company mail, with Undo in the note', async () => {
    post.mockImplementation(async (path: string) =>
      path === '/api/conversations/thread-1/block' ? block() : { seen: true },
    );
    show('/mails/thread-1');
    await openMenu();
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Block new mails from northwind.example' }),
    );
    expect(await screen.findByText('New mails from northwind.example are blocked.')).toBeVisible();
    expect(post).toHaveBeenCalledWith('/api/conversations/thread-1/block', {});
  });

  it('offers Unblock once the company is blocked', async () => {
    blocked = [block()];
    del.mockResolvedValue({ unblocked: true });
    show('/mails/thread-1');
    await openMenu();
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Unblock new mails from northwind.example' }),
    );
    await waitFor(() =>
      expect(del).toHaveBeenCalledWith('/api/blocked-senders/22222222-2222-4222-8222-222222222222'),
    );
  });

  it('has no block for LinkedIn, only delete', async () => {
    detail.conversation = makeConversation({ sender: LINKEDIN });
    show('/mails/thread-1');
    await openMenu();
    expect(await screen.findByRole('menuitem', { name: 'Delete from NorthList…' })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: /Block new mails/ })).not.toBeInTheDocument();
  });
});

describe('deleting a conversation', () => {
  it('asks first, can also block the company, then goes back to Mails', async () => {
    del.mockResolvedValue({ deleted: 2, blocked: 'northwind.example' });
    const router = show('/mails/thread-1');
    await openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete from NorthList…' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Delete this conversation from NorthList?',
    });
    expect(within(dialog).getByText('its 2 mails, their subjects and senders')).toBeVisible();
    expect(within(dialog).getByText(/Your Gmail is not changed/)).toBeVisible();
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Also stop reading new mails/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/mails'));
    expect(del).toHaveBeenCalledWith('/api/conversations/thread-1', { block: true });
    expect(
      await screen.findByText('Deleted. New mails from northwind.example are blocked.'),
    ).toBeVisible();
  });

  it('has no block choice for LinkedIn, and says when the AI is still reading', async () => {
    detail.conversation = makeConversation({ sender: LINKEDIN });
    del.mockRejectedValue(
      new ApiError(
        'The AI is reading a mail of this conversation right now. Try again in a minute.',
        'http',
        409,
        'MAIL_BEING_READ',
      ),
    );
    show('/mails/thread-1');
    await openMenu();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete from NorthList…' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText(/Try again in a minute/)).toBeVisible();
    expect(del).toHaveBeenCalledWith('/api/conversations/thread-1', { block: false });
  });
});

describe('the Restricted tab', () => {
  it('lists blocked companies, and unblocks one', async () => {
    blocked = [block({ source: 'DELETE', domain: 'infosys.com' })];
    del.mockResolvedValue({ unblocked: true });
    show('/mails?tab=restricted');
    expect(await screen.findByText('infosys.com')).toBeVisible();
    expect(screen.getByText('When you deleted a conversation')).toBeVisible();
    expect(screen.getByRole('tab', { name: /Restricted/ })).toHaveTextContent('(1)');
    fireEvent.click(screen.getByRole('button', { name: 'Unblock' }));
    expect(await screen.findByText('New mails from infosys.com come in again.')).toBeVisible();
  });

  it('says how to block when nothing is blocked', async () => {
    show('/mails?tab=restricted');
    expect(await screen.findByText('No companies blocked')).toBeVisible();
  });
});

describe('deleting an application', () => {
  it('asks first, then goes back to Applications', async () => {
    vi.mocked(api.getApplication).mockResolvedValue(
      makeApplication({ id: '33333333-3333-4333-8333-333333333333', companyName: 'Quanta Labs' }),
    );
    vi.mocked(api.getApplicationEvents).mockResolvedValue(page([]));
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
    del.mockResolvedValue({ deleted: true });
    const router = show('/applications/33333333-3333-4333-8333-333333333333');
    fireEvent.click(await screen.findByRole('button', { name: 'More actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete application…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete Quanta Labs?' });
    expect(within(dialog).getByText(/Its mails stay in Mails/)).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete application' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/applications'));
    expect(del).toHaveBeenCalledWith('/api/applications/33333333-3333-4333-8333-333333333333');
  });
});
