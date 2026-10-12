// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { ConversationDetail } from '../contracts/conversation';
import type { MailThread } from '../contracts/mailbox';
import {
  makeApplication,
  makeConversation,
  makeConversationMail,
  makeEvent,
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
    getApplication: vi.fn(),
    getApplicationEvents: vi.fn(),
    getApplicationActions: vi.fn(),
  },
}));

import { routeTree } from '../routeTree.gen';

const page = <T,>(items: T[]) => ({ items, metadata: { limit: 20, offset: 0, nextOffset: null } });
const reply = makeMailMessage({
  id: 'message-2',
  from: 'Me <me@example.com>',
  to: 'Priya Nair <priya.nair@northwind.example>',
  date: '2026-10-11T08:45:00.000Z',
  labels: ['Sent'],
  sentByUser: true,
  text: 'I am free on Tuesday after 2 PM.',
});

let detail: ConversationDetail;
let thread: MailThread | ApiError;
const get = vi.mocked(api.get);

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
  detail = { conversation: makeConversation(), mails: [makeConversationMail()], sentAt: [] };
  thread = {
    threadId: 'thread-1',
    subject: detail.conversation.subject,
    messages: [makeMailMessage()],
  };
  get.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/conversations?')) return page([detail.conversation]);
    if (path.startsWith('/api/conversations/')) return detail;
    if (path.startsWith('/api/mailbox/threads/')) {
      if (thread instanceof ApiError) throw thread;
      return thread;
    }
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  vi.mocked(api.post).mockResolvedValue({ seen: true });
  vi.mocked(api.getGmailStatus).mockResolvedValue({
    connected: true,
    gmailEmail: 'you@gmail.com',
    status: 'CONNECTED',
    syncStatus: 'IDLE',
    lastSyncedAt: null,
  });
  vi.mocked(api.getAISettings).mockRejectedValue(new ApiError('n/a', 'http', 404));
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('job mail details', () => {
  it('shows the mail as Gmail has it beside what it needs, and ends the New mark', async () => {
    thread = {
      threadId: 'thread-1',
      subject: 'Interview: first round availability',
      messages: [
        makeMailMessage({
          labels: ['Inbox', 'Job search'],
          attachments: [
            { partId: '1', filename: 'JD.pdf', mimeType: 'application/pdf', size: 188_416 },
          ],
        }),
      ],
    };
    // Opened by the ID of one of its emails, as an application timeline does.
    show('/mails/11111111-1111-4111-8111-111111111111');

    expect(
      await screen.findByRole('heading', { name: 'Interview: first round availability' }),
    ).toBeInTheDocument();
    const mail = within(await screen.findByRole('article'));
    expect(mail.getByText('Priya Nair')).toBeInTheDocument();
    expect(mail.getByText('priya.nair@northwind.example')).toBeInTheDocument();
    expect(mail.getByText('to me')).toBeInTheDocument();
    expect(mail.getByText('Job search')).toBeInTheDocument();
    expect(mail.getByText('Could you share the dates you are free next week?')).toBeInTheDocument();
    expect(mail.getByText('· PDF · 184 KB')).toBeInTheDocument();
    expect(mail.getByRole('link', { name: 'Download JD.pdf' })).toHaveAttribute(
      'href',
      '/api/mailbox/messages/message-1/attachments/1',
    );
    expect(screen.getByText('Conversation · 1 mail')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Open email .* in Gmail$/ })).toHaveAttribute(
      'href',
      expect.stringContaining('thread-1'),
    );
    expect(screen.getByRole('link', { name: /^Reply to email .* in Gmail$/ })).toBeInTheDocument();

    const panel = within(screen.getByRole('complementary', { name: 'About this job mail' }));
    expect(panel.getByText('Send your available dates')).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /^Mark done/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Create application' })).toBeInTheDocument();
    expect(panel.getByText('What the AI read in this mail')).toBeInTheDocument();
    expect(panel.getByText('First round, video')).toBeInTheDocument();
    expect(panel.getByText(/not the mail's own words/)).toBeInTheDocument();

    // The mark ends with the conversation's own key, not the email ID in the URL.
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/conversations/thread-1/seen', {}),
    );
  });

  it("shows the user's reply in its place, and lets a replied action be closed or asked again", async () => {
    const { conversation } = detail;
    detail = {
      ...detail,
      conversation: {
        ...conversation,
        isNew: false,
        sentCount: 1,
        request: {
          ...conversation.request!,
          state: 'REPLIED',
          repliedAt: '2026-10-11T08:45:00.000Z',
        },
      },
      sentAt: ['2026-10-11T08:45:00.000Z'],
    };
    thread = { threadId: 'thread-1', subject: 'Interview', messages: [makeMailMessage(), reply] };
    show('/mails/thread-1');

    const mails = await screen.findAllByRole('article');
    expect(mails).toHaveLength(2);
    expect(within(mails[0]).getByText('Priya Nair')).toBeInTheDocument();
    expect(within(mails[1]).getByText('You')).toBeInTheDocument();
    expect(within(mails[1]).getByText('Your reply')).toBeInTheDocument();
    expect(within(mails[1]).getByText('to Priya Nair')).toBeInTheDocument();
    expect(within(mails[1]).getByText('I am free on Tuesday after 2 PM.')).toBeInTheDocument();
    expect(screen.getByText('Conversation · 2 mails · 1 from you')).toBeInTheDocument();

    const panel = within(screen.getByRole('complementary', { name: 'About this job mail' }));
    expect(panel.getByText('Replied')).toBeInTheDocument();
    expect(panel.getByText(/We do not read what you wrote/)).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /^Mark done/ })).toBeInTheDocument();
    vi.mocked(api.patch).mockResolvedValue(detail.conversation);
    fireEvent.click(panel.getByRole('button', { name: /^Ask me again/ }));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/api/conversations/thread-1/request', {
        emailId: '11111111-1111-4111-8111-111111111111',
        state: 'OPEN',
      }),
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it('keeps the job panel when Gmail cannot be read', async () => {
    thread = new ApiError(
      'Gmail access ended. Reconnect Gmail.',
      'http',
      409,
      'GMAIL_NOT_CONNECTED',
    );
    show('/mails/thread-1');
    expect(await screen.findByText('Gmail access ended. Reconnect Gmail.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Gmail Sync' })).toBeInTheDocument();
    expect(screen.getByText('Send your available dates')).toBeInTheDocument();
  });

  it("shows the sender's HTML only in a frame that runs no script and loads nothing", async () => {
    thread = {
      threadId: 'thread-1',
      subject: 'Interview',
      messages: [
        makeMailMessage({
          text: null,
          html: '<p>Hello</p><img src="https://track.example/pixel.gif"><script>x</script>',
        }),
      ],
    };
    show('/mails/thread-1');
    const frame = await screen.findByTitle('Mail text');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-forms');
    expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'");
    expect(frame.getAttribute('srcdoc')).toContain('img-src data:"');
    // The mail's own markup never becomes part of the app's page.
    expect(document.querySelector('script')).toBeNull();
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show images' }));
    expect(screen.getByTitle('Mail text').getAttribute('srcdoc')).toContain(
      'img-src https: data:"',
    );
    expect(screen.queryByRole('button', { name: 'Show images' })).not.toBeInTheDocument();
  });
});

describe('a mail that is not a job mail', () => {
  it('shows the conversation only', async () => {
    thread = {
      threadId: 'gmail-9',
      subject: 'Sunday lunch?',
      messages: [
        makeMailMessage({ from: 'Meera <meera@family.example>', text: 'Are you coming?' }),
      ],
    };
    show('/mails/gmail/gmail-9');
    expect(await screen.findByRole('heading', { name: 'Sunday lunch?' })).toBeInTheDocument();
    expect(screen.getByText('Are you coming?')).toBeInTheDocument();
    expect(screen.getByText('Not a job mail')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Gmail' })).toHaveAttribute(
      'href',
      '/mails?tab=gmail',
    );
    expect(screen.queryByRole('button', { name: 'Create application' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations'),
      expect.anything(),
    );
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe('test environment', () => {
  it('records a test reply in a test thread, and offers no Gmail link for it', async () => {
    vi.stubEnv('VITE_TEST_TOOLS', 'true');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ enabled: true }), { status: 200 })),
    );
    detail = {
      ...detail,
      conversation: makeConversation({ key: 'sim-thread-1', threadId: 'sim-thread-1' }),
    };
    thread = { threadId: 'sim-thread-1', subject: 'Interview', messages: [makeMailMessage()] };
    show('/mails/sim-thread-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Record my reply (test)' }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/api/test-tools/replies', {
        threadId: 'sim-thread-1',
      }),
    );
    expect(screen.queryByRole('link', { name: /in Gmail$/ })).not.toBeInTheDocument();
  });

  it('shows no test button in a normal build', async () => {
    show('/mails/thread-1');
    await screen.findByRole('article');
    expect(screen.queryByRole('button', { name: /test/i })).not.toBeInTheDocument();
  });
});

describe('application page', () => {
  it('lists its conversations and opens a mail from the timeline, with no Agenda link', async () => {
    const application = makeApplication({ id: 'app-1', companyName: 'Northwind Robotics' });
    vi.mocked(api.getApplication).mockResolvedValue(application);
    vi.mocked(api.getApplicationActions).mockResolvedValue(page([]));
    vi.mocked(api.getApplicationEvents).mockResolvedValue(
      page([
        makeEvent({
          emailId: 'email-7',
          sourceEmail: {
            id: 'email-7',
            subject: 'We received your application',
            sender: 'careers@northwind.example',
            receivedAt: '2026-10-03T10:50:00.000Z',
          },
        }),
      ]),
    );
    show('/applications/app-1');

    const section = within(await screen.findByRole('region', { name: 'Conversations' }));
    const subject = await section.findByRole('link', {
      name: 'Interview: first round availability',
    });
    expect(subject).toHaveAttribute('href', '/mails/thread-1');
    expect(section.getByText('Needs action')).toBeInTheDocument();
    // The list here only shows: its buttons are on the Mails page.
    expect(section.queryByRole('button')).not.toBeInTheDocument();
    expect(section.queryByText('Application')).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('application=app-1'),
      expect.anything(),
    );

    expect(await screen.findByRole('link', { name: 'Open mail' })).toHaveAttribute(
      'href',
      '/mails/email-7',
    );
    expect(screen.queryByRole('link', { name: /agenda/i })).not.toBeInTheDocument();
  });
});
