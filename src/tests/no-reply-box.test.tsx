// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { ConversationDetail } from '../contracts/conversation';
import { NO_REPLY_NOTE, NO_REPLY_SHORT } from '../lib/mailReply';
import { makeConversation, makeConversationMail, makeMailMessage } from './fixtures';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    getGmailStatus: vi.fn(),
    getAISettings: vi.fn(),
  },
}));

import { routeTree } from '../routeTree.gen';

/** A made-up applicant-tracking system's own address: nobody reads a reply to it. */
const SYSTEM = 'Lumen Works <lumenworks@ats-mail.example>';
const PHONE_WIDTH = 375;
const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });

let detail: ConversationDetail;
/** What the server says about a reply: false, true, or nothing at all (an older server). */
let canReply: boolean | undefined;
let desktopWidth: number;

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
  canReply = false;
  detail = {
    conversation: makeConversation({ sender: SYSTEM }),
    mails: [makeConversationMail({ sender: SYSTEM })],
    sentAt: [],
    // The server sends none for such a sender; the page must not depend on that.
    replyChoices: ['I have done it'],
  };
  vi.mocked(api.get).mockImplementation(async (path: string) => {
    if (path.startsWith('/api/conversations?')) return page([detail.conversation]);
    if (path.startsWith('/api/conversations/')) return detail;
    if (path.startsWith('/api/mailbox/threads/'))
      return {
        threadId: 'thread-1',
        subject: detail.conversation.subject,
        messages: [makeMailMessage({ from: SYSTEM })],
        replyTo: SYSTEM,
        ...(canReply === undefined ? {} : { canReply }),
      };
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  vi.mocked(api.post).mockResolvedValue({ seen: true });
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

describe('a sender no reply can reach (owner, 26 Nov 2026)', () => {
  it('says the two lengths of the same thing', () => {
    expect(NO_REPLY_SHORT).toBe("This sender can't get a reply");
    expect(NO_REPLY_NOTE).toBe(
      "This sender can't get a reply. Nobody reads mail sent to this address.",
    );
  });

  it('laptop: a note in place of the reply box, with the way to Gmail and no AI', async () => {
    show('/mails/thread-1');
    const notice = within(await screen.findByRole('region', { name: 'Reply' }));
    expect(notice.getByText(NO_REPLY_NOTE)).toBeInTheDocument();
    expect(notice.getByRole('link', { name: /^Reply to email .* in Gmail$/ })).toBeInTheDocument();
    expect(notice.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Reply to Lumen Works/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reply with AI' })).not.toBeInTheDocument();
    // The page's own Reply button would open nothing, so it is gone too.
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();

    // "R" opens nothing.
    fireEvent.keyDown(document, { key: 'r' });
    expect(screen.queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument();
    expect(screen.queryByText('I have done it')).not.toBeInTheDocument();
  });

  it.each([[true], [undefined]])(
    'laptop: the reply box as before when the server says %s',
    async (answer) => {
      canReply = answer;
      show('/mails/thread-1');
      expect(await screen.findByText('Reply to Lumen Works…')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reply with AI' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
      expect(screen.queryByText(NO_REPLY_NOTE)).not.toBeInTheDocument();
    },
  );

  it('phone: the bottom bar only says so, and Open in Gmail stays', async () => {
    setWidth(PHONE_WIDTH);
    show('/mails/thread-1');
    const bar = within(await screen.findByRole('navigation', { name: 'Mail actions' }));
    expect(await bar.findByText(NO_REPLY_SHORT)).toBeInTheDocument();
    expect(bar.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Open in Gmail',
    ]);
    // No second note under the mails, and nothing to open a reply with.
    expect(screen.queryByRole('region', { name: 'Reply' })).not.toBeInTheDocument();
    expect(screen.queryByText(NO_REPLY_NOTE)).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument();
  });

  it('a plain Gmail mail on a phone has no bar to say it: the note shows, the Reply button goes', async () => {
    setWidth(PHONE_WIDTH);
    show('/mails/gmail/thread-1');
    const notice = within(await screen.findByRole('region', { name: 'Reply' }));
    expect(notice.getByText(NO_REPLY_NOTE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reply' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument();
  });

  it('phone: AI reply and Reply as before for a sender who can get one', async () => {
    canReply = true;
    setWidth(PHONE_WIDTH);
    show('/mails/thread-1');
    const bar = within(await screen.findByRole('navigation', { name: 'Mail actions' }));
    expect(await bar.findByRole('button', { name: 'Reply' })).toHaveTextContent(
      'Reply to Lumen Works',
    );
    expect(bar.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'AI reply',
      'Reply',
      'Open in Gmail',
    ]);
    expect(bar.queryByText(NO_REPLY_SHORT)).not.toBeInTheDocument();
  });
});
