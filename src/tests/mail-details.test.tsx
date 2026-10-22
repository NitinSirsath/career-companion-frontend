// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError, api } from '../api/client';
import type { ConversationDetail } from '../contracts/conversation';
import type { z } from 'zod';
import type { MailThreadSchema } from '../contracts/mailbox';
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
import { chooseOption } from './choose';

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

const PRIYA = 'Priya Nair <priya.nair@northwind.example>';
const DANIEL = 'Daniel Okafor <daniel.okafor@northwind.example>';
const LENA = 'Lena Fischer <lena.fischer@northwind.example>';
const REPLY_PATH = '/api/mailbox/threads/thread-1/replies';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let detail: ConversationDetail;
/** As the server sends it. */
let thread: z.input<typeof MailThreadSchema> | ApiError;
/** What the send call answers; an error is thrown. */
let sendAnswer: object | ApiError;
const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const sent = () => post.mock.calls.filter(([path]) => path === REPLY_PATH);
const threadReads = () =>
  get.mock.calls.filter(([path]) => path.startsWith('/api/mailbox/threads/')).length;

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
    replyTo: PRIYA,
  };
  sendAnswer = { id: 'sent-1', threadId: 'thread-1', sentAt: '2026-10-11T08:45:00.000Z' };
  get.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/conversations?')) return page([detail.conversation]);
    if (path.startsWith('/api/conversations/')) return detail;
    if (path.startsWith('/api/mailbox/threads/')) {
      if (thread instanceof ApiError) throw thread;
      return thread;
    }
    throw new ApiError('Not found', 'http', 404, 'NOT_FOUND');
  });
  post.mockImplementation(async (path: string) => {
    if (path !== REPLY_PATH) return { seen: true };
    if (sendAnswer instanceof ApiError) throw sendAnswer;
    return sendAnswer;
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
      replyTo: PRIYA,
    };
    // Opened by the ID of one of its emails, as an application timeline does.
    show('/mails/11111111-1111-4111-8111-111111111111');

    expect(
      await screen.findByRole('heading', { name: 'Interview: first round availability' }),
    ).toBeInTheDocument();
    const breadcrumb = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(breadcrumb.getByRole('link', { name: 'Mails' })).toHaveAttribute('href', '/mails');
    expect(breadcrumb.getByText('Northwind Robotics').closest('li')).toHaveAttribute(
      'aria-current',
      'page',
    );
    const article = await screen.findByRole('article');
    const mail = within(article);
    expect(mail.getByText('Priya Nair')).toBeInTheDocument();
    // The address shows on hover; Gmail labels are left out as noise.
    expect(mail.getByTitle('priya.nair@northwind.example')).toBeInTheDocument();
    expect(mail.getByText('to me')).toBeInTheDocument();
    expect(mail.queryByText('Job search')).not.toBeInTheDocument();
    expect(mail.getByText('Could you share the dates you are free next week?')).toBeInTheDocument();
    expect(mail.getByText('PDF · 184 KB')).toBeInTheDocument();
    expect(mail.getByRole('link', { name: 'Download JD.pdf' })).toHaveAttribute(
      'href',
      '/api/mailbox/messages/message-1/attachments/1',
    );
    expect(screen.getByText('1 mail')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Open email .* in Gmail$/ })).toHaveAttribute(
      'href',
      expect.stringContaining('thread-1'),
    );

    const panel = within(screen.getByRole('complementary', { name: 'About this job mail' }));
    expect(panel.getByText('Send your available dates')).toBeInTheDocument();
    expect(panel.getByRole('button', { name: /^Mark done/ })).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Create application' })).toBeInTheDocument();
    // The AI's reading sits under the mail it read, not in the side panel.
    expect(panel.queryByText(/What the AI read/)).not.toBeInTheDocument();
    expect(mail.getByText('Asks you')).toBeInTheDocument();
    fireEvent.click(mail.getByRole('button', { name: /^AI read:/ }));
    expect(mail.getByText('First round, video')).toBeInTheDocument();
    expect(mail.getByText(/not the mail's own words/)).toBeInTheDocument();

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
    thread = {
      threadId: 'thread-1',
      subject: 'Interview',
      messages: [makeMailMessage(), reply],
      replyTo: PRIYA,
    };
    show('/mails/thread-1');

    const mails = await screen.findAllByRole('article');
    expect(mails).toHaveLength(2);
    expect(within(mails[0]).getByText('Priya Nair')).toBeInTheDocument();
    expect(within(mails[1]).getByText('You')).toBeInTheDocument();
    expect(within(mails[1]).getByText('to Priya Nair')).toBeInTheDocument();
    expect(within(mails[1]).getByText('I am free on Tuesday after 2 PM.')).toBeInTheDocument();
    expect(screen.getByText('2 mails · 1 from you')).toBeInTheDocument();

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

  it('names the company, role, status and mail count under the title, and the way to Gmail', async () => {
    detail = {
      ...detail,
      conversation: makeConversation({
        link: 'LINKED',
        application: {
          id: '33333333-3333-4333-8333-333333333333',
          companyName: 'Northwind Robotics',
          jobTitle: 'Senior Platform Engineer',
          effectiveStatus: 'INTERVIEW',
          archived: false,
        },
      }),
    };
    show('/mails/thread-1');
    const title = await screen.findByRole('heading', {
      name: 'Interview: first round availability',
    });
    const header = within(title.closest('header')!);
    expect(header.getByText('Northwind Robotics')).toBeInTheDocument();
    expect(header.getByText('Senior Platform Engineer')).toBeInTheDocument();
    expect(header.getByText('Interview')).toBeInTheDocument();
    expect(await header.findByText('1 mail')).toBeInTheDocument();
    expect(header.getByRole('link', { name: /in Gmail$/ })).toBeInTheDocument();
    expect(header.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
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
      replyTo: PRIYA,
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
      replyTo: 'Meera <meera@family.example>',
    };
    show('/mails/gmail/gmail-9');
    expect(await screen.findByRole('heading', { name: 'Sunday lunch?' })).toBeInTheDocument();
    expect(screen.getByText('Are you coming?')).toBeInTheDocument();
    expect(screen.getByText('Not a job mail')).toBeInTheDocument();
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Gmail' })).toHaveAttribute(
      'href',
      '/mails?tab=gmail',
    );
    expect(screen.queryByRole('button', { name: 'Create application' })).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/conversations'),
      expect.anything(),
    );
    expect(api.post).not.toHaveBeenCalled();
    // A plain Gmail mail can be answered from here too.
    fireEvent.click(screen.getByRole('button', { name: /^Reply to Meera…/ }));
    expect(
      within(await screen.findByRole('form', { name: 'Reply' })).getByText('Meera'),
    ).toBeInTheDocument();
  });
});

describe('replying from the mail details page', () => {
  /** Opens the docked reply box, which waits as one line until the user starts a reply. */
  const box = async () => {
    fireEvent.click(await screen.findByRole('button', { name: /^Reply to .*…/ }));
    return within(await screen.findByRole('form', { name: 'Reply' }));
  };
  const write = (form: Awaited<ReturnType<typeof box>>, text: string) =>
    fireEvent.change(form.getByLabelText('Your reply'), { target: { value: text } });

  it('puts the cursor in the reply when the box opens, by click or by "R"', async () => {
    show('/mails/thread-1');
    const form = await box();
    expect(form.getByLabelText('Your reply')).toHaveFocus();
    cleanup();
    show('/mails/thread-1');
    await screen.findByRole('button', { name: /^Reply to .*…/ });
    fireEvent.keyDown(document.body, { key: 'r' });
    expect(await screen.findByLabelText('Your reply')).toHaveFocus();
  });

  it('opens the reply box from the Reply button next to the title', async () => {
    show('/mails/thread-1');
    await screen.findByRole('button', { name: /^Reply to .*…/ });
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    expect(await screen.findByLabelText('Your reply')).toHaveFocus();
  });

  it('says who the reply goes to and offers no way to change it', async () => {
    show('/mails/thread-1');
    const form = await box();
    expect(form.getByText('To').nextElementSibling).toHaveTextContent('Priya Nair');
    expect(form.queryByRole('textbox', { name: /^to/i })).not.toBeInTheDocument();
    expect(form.getByText(/^Sent from your Gmail, in this conversation\./)).toBeInTheDocument();
    // Gmail itself stays one click away.
    expect(form.getByRole('link', { name: /^Reply to email .* in Gmail$/ })).toBeInTheDocument();
  });

  it('sends the reply once with its own ID, then shows it sent and reads the conversation again', async () => {
    show('/mails/thread-1');
    const form = await box();
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
    expect(await form.findByText('Write your reply.')).toBeInTheDocument();
    expect(sent()).toHaveLength(0);

    const reads = threadReads();
    write(form, 'I am free on Tuesday after 2 PM.');
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
    expect(await form.findByText('Reply sent to Priya Nair.')).toBeInTheDocument();
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toEqual([
      REPLY_PATH,
      { replyId: expect.stringMatching(UUID), text: 'I am free on Tuesday after 2 PM.' },
      undefined,
      60_000,
    ]);
    expect(form.getByLabelText('Your reply')).toHaveValue('');
    await waitFor(() => expect(threadReads()).toBeGreaterThan(reads));
  });

  it('gives the next reply a new ID', async () => {
    show('/mails/thread-1');
    const form = await box();
    for (const text of ['First.', 'Second.']) {
      write(form, text);
      fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
      await waitFor(() => expect(form.getByLabelText('Your reply')).toHaveValue(''));
    }
    const ids = sent().map(([, body]) => (body as { replyId: string }).replyId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  describe('when other people are on the mail', () => {
    beforeEach(() => {
      thread = {
        threadId: 'thread-1',
        subject: 'Interview',
        messages: [makeMailMessage({ to: `me@example.com, ${DANIEL}`, cc: LENA })],
        replyTo: PRIYA,
        replyCc: [DANIEL, LENA],
      };
    });

    it('names them on the mail and replies to all of them unless the user says not', async () => {
      show('/mails/thread-1');
      const form = await box();
      expect(
        within(screen.getByRole('article')).getByText('to me, Daniel Okafor · cc Lena Fischer'),
      ).toBeInTheDocument();
      expect(form.getByText('Reply to all · 3 people')).toBeInTheDocument();
      expect(form.getByText('To').nextElementSibling).toHaveTextContent('Priya Nair');
      expect(form.getByText('Cc').parentElement).toHaveTextContent('CcDaniel OkaforLena Fischer');
      // The two choices are all there is: no address can be typed.
      expect(form.getAllByRole('textbox')).toHaveLength(1);

      write(form, 'Tuesday works.');
      fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
      expect(
        await form.findByText('Reply sent to Priya Nair, Daniel Okafor and Lena Fischer.'),
      ).toBeInTheDocument();
      expect(sent()[0][1]).toEqual({
        replyId: expect.stringMatching(UUID),
        text: 'Tuesday works.',
        toAll: true,
      });
    });

    it('goes to the sender alone when the user chooses that, says who is left out, and can go back', async () => {
      show('/mails/thread-1');
      const form = await box();
      await chooseOption(
        form.getByRole('combobox', { name: 'Who gets this reply' }),
        'Reply only to Priya Nair',
      );
      expect(form.getByText('Reply only to Priya Nair')).toBeInTheDocument();
      expect(form.queryByText('Cc')).not.toBeInTheDocument();
      expect(
        form.getByText('Daniel Okafor and Lena Fischer will not get this reply.'),
      ).toBeInTheDocument();

      write(form, 'A question first.');
      fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
      expect(await form.findByText('Reply sent to Priya Nair.')).toBeInTheDocument();
      expect(sent()[0][1]).toEqual({
        replyId: expect.stringMatching(UUID),
        text: 'A question first.',
      });

      // Going back changes the next reply, not the note about the one that was sent.
      await chooseOption(
        form.getByRole('combobox', { name: 'Who gets this reply' }),
        'Reply to all · 3 people',
      );
      expect(form.getByText('Reply to all · 3 people')).toBeInTheDocument();
      expect(form.getByText('Cc')).toBeInTheDocument();
      expect(form.getByText('Reply sent to Priya Nair.')).toBeInTheDocument();
    });
  });

  it('offers no choice when nobody else is on the mail', async () => {
    show('/mails/thread-1');
    const form = await box();
    expect(within(await screen.findByRole('article')).getByText('to me')).toBeInTheDocument();
    expect(form.queryByRole('combobox', { name: 'Who gets this reply' })).not.toBeInTheDocument();
    expect(form.queryByText('Cc')).not.toBeInTheDocument();
  });

  it.each([
    ['the server could not confirm it', new ApiError('x', 'http', 502, 'MAIL_REPLY_UNCONFIRMED')],
    ['the request timed out', new ApiError('The request timed out.', 'timeout')],
    ['the connection was lost', new ApiError('Network error', 'network')],
  ])('sends nothing again by itself when %s', async (_label, failure) => {
    sendAnswer = failure;
    show('/mails/thread-1');
    const form = await box();
    write(form, 'I am free on Tuesday.');
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));

    expect(await form.findByRole('alert')).toHaveTextContent(
      'Could not confirm that your reply was sent',
    );
    expect(form.getByRole('alert')).toHaveTextContent(
      'Check the conversation before you send it again',
    );
    expect(form.getByLabelText('Your reply')).toHaveValue('I am free on Tuesday.');
    expect(form.queryByRole('button', { name: 'Send reply' })).not.toBeInTheDocument();
    expect(sent()).toHaveLength(1);

    const reads = threadReads();
    fireEvent.click(form.getByRole('button', { name: 'Check the conversation' }));
    await waitFor(() => expect(threadReads()).toBeGreaterThan(reads));
    expect(sent()).toHaveLength(1);

    // Sending again is the user's decision, and a new reply.
    sendAnswer = { id: 'sent-2', threadId: 'thread-1', sentAt: '2026-10-11T08:50:00.000Z' };
    fireEvent.click(form.getByRole('button', { name: 'Send again' }));
    expect(await form.findByText('Reply sent to Priya Nair.')).toBeInTheDocument();
    const [first, second] = sent().map(([, body]) => body as { replyId: string; text: string });
    expect(second.text).toBe('I am free on Tuesday.');
    expect(second.replyId).not.toBe(first.replyId);
  });

  it('says so when nothing was sent, and sends the same reply on the next try', async () => {
    sendAnswer = new ApiError(
      'Gmail is busy. Nothing was sent. Try again.',
      'http',
      502,
      'GMAIL_UNAVAILABLE',
    );
    show('/mails/thread-1');
    const form = await box();
    write(form, 'I am free on Tuesday.');
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
    expect(await form.findByRole('alert')).toHaveTextContent(
      'Gmail is busy. Nothing was sent. Try again.',
    );
    expect(form.getByLabelText('Your reply')).toHaveValue('I am free on Tuesday.');

    sendAnswer = { id: 'sent-1', threadId: 'thread-1', sentAt: '2026-10-11T08:45:00.000Z' };
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
    expect(await form.findByText('Reply sent to Priya Nair.')).toBeInTheDocument();
    const [first, second] = sent().map(([, body]) => (body as { replyId: string }).replyId);
    expect(second).toBe(first);
  });

  it('offers "Allow sending" when Gmail is connected for reading only, and comes back to this mail', async () => {
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      gmailEmail: 'you@gmail.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
      canSend: false,
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    show('/mails/thread-1');
    const notice = within(await screen.findByRole('region', { name: 'Reply' }));
    expect(notice.getByText(/may read your Gmail, but not send from it yet/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument();
    expect(notice.getByRole('link', { name: /^Reply to email .* in Gmail$/ })).toBeInTheDocument();

    fireEvent.click(notice.getByRole('button', { name: 'Allow sending' }));
    expect(assign).toHaveBeenCalledWith('/api/gmail/connect?returnTo=%2Fmails%2Fthread-1');
    expect(sent()).toHaveLength(0);
  });

  it('switches to "Allow sending" when the server says the connection may not send', async () => {
    sendAnswer = new ApiError(
      'Allow sending to reply from here.',
      'http',
      403,
      'GMAIL_SEND_NOT_ALLOWED',
    );
    show('/mails/thread-1');
    const form = await box();
    write(form, 'I am free on Tuesday.');
    vi.mocked(api.getGmailStatus).mockResolvedValue({
      connected: true,
      gmailEmail: 'you@gmail.com',
      status: 'CONNECTED',
      syncStatus: 'IDLE',
      lastSyncedAt: null,
      canSend: false,
    });
    fireEvent.click(form.getByRole('button', { name: 'Send reply' }));
    expect(await screen.findByRole('button', { name: 'Allow sending' })).toBeInTheDocument();
  });

  it('has no reply box when nobody else wrote in the conversation', async () => {
    thread = { threadId: 'thread-1', subject: 'Interview', messages: [reply], replyTo: null };
    show('/mails/thread-1');
    const notice = within(await screen.findByRole('region', { name: 'Reply' }));
    expect(notice.getByText(/Nobody else wrote in this conversation/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Reply' })).not.toBeInTheDocument();
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

    // The top bar says where the page sits: the list above it, then the company.
    const company = await screen.findByText('Northwind Robotics', { selector: 'nav li > span' });
    expect(company.closest('li')).toHaveAttribute('aria-current', 'page');
    const breadcrumb = company.closest('nav')!;
    expect(breadcrumb).toHaveAccessibleName('Breadcrumb');
    expect(within(breadcrumb).getByRole('link', { name: 'Applications' })).toHaveAttribute(
      'href',
      '/applications',
    );
    expect(breadcrumb.closest('header')).toContainElement(
      screen.getByRole('button', { name: 'Account menu' }),
    );

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

    // A history row names its mail and links to it.
    expect(
      await screen.findByRole('link', {
        name: 'Mail from careers@northwind.example: We received your application',
      }),
    ).toHaveAttribute('href', '/mails/email-7');
    // The menu has an Agenda entry; the application page itself links to no Agenda.
    expect(
      within(screen.getByRole('main')).queryByRole('link', { name: /agenda/i }),
    ).not.toBeInTheDocument();
  });
});
